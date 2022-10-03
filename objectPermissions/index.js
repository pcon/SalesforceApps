/**
 * Script that takes an object and outputs a CSV file of all users
 * that have access to that object and what permissions they have
 * for that object
 *
 * @author Patrick Connelly <patrick@connelly.dev>
 * @since 1.0.0
 */

const commander = require('commander');
const csvWriter = require('csv-writer');
const fs = require('fs');
const solenopsis = require('solenopsis');

const get = require('lodash/get');
const join = require('lodash/join');
const keyBy = require('lodash/keyBy');
const map = require('lodash/map');
const values = require('lodash/values');

const sfdc = require('./sfdc');

const pkg = require('./package.json');

const FULLNAME = 'fullName';
const PERMSET = 'PermissionSet';
const PROFILE = 'Profile';
const ID = 'id';
const OR = ' OR ';
const TRUE = 'true';

const OBJECTPERMFIELDS = [
    'allowCreate',
    'allowDelete',
    'allowEdit',
    'allowRead',
    'modifyAllRecords',
    'viewAllRecords'
];

const PERMSETGROUPID = 'PermissionSetGroupId';
const PERMSETGROUP = 'PermissionSetGroupComponent';
const PERMSETGROUP_FIELDS = [
    ID,
    'PermissionSetGroup.DeveloperName',
    'PermissionSetGroup.MasterLabel',
    'PermissionSetId',
    PERMSETGROUPID
];

const ASSIGNEEID = 'AssigneeId';
const PERMSET_ASSIGNMENT = 'PermissionSetAssignment';
const PERMSET_ASSIGNMENT_FIELDS = [
    'PermissionSetId',
    PERMSETGROUPID,
    ASSIGNEEID
];

const USER = 'User';
const USER_FIELDS = [
    ID,
    'Username',
    'ProfileId'
];

const solenopsis_opts = {
    client_name: pkg.name,
    client_version: pkg.version
};

let metadata_global = {
    [PROFILE]: {},
    [PERMSET]: {}
};

let getProfilePermissions_bound, getPermSetPermissions_bound, query_bound, metadataList_bound, bulkQuery_bound;

const program = commander.program;

program.requiredOption('-e, --environment <env>', 'The Solenopsis environment name')
    .requiredOption('-o, --objectName <name>', 'The Salesfore object name')
    .requiredOption('-f, --file <csvfile>', 'The filename to output')
    .option('--force', 'Overwrite any existing files');

program.parse();

const opts = program.opts();

/**
 * Binds all the functions with the Salesforce connection
 * @param {Object} conn The Salesforce connection
 * @return {Promise} A promise for when the functions have been bound
 */
function bind(conn) {
    console.info('Binding functions');

    return new Promise(function (resolve) {
        getProfilePermissions_bound = getProfilePermissions.bind(null, conn);
        getPermSetPermissions_bound = getPermSetPermissions.bind(null, conn);
        metadataList_bound = sfdc.metadata.list.bind(null, conn);
        query_bound = sfdc.query.bind(null, conn);
        bulkQuery_bound = sfdc.bulk_query.bind(null, conn);
        resolve();
    });
}

/**
 * Check to see if there is any access
 * @param {Object} object_perms The object permissions
 * @returns {Boolean} If there is any access to the object
 */
function hasAnyAccess(object_perms) {
    let canAccess = false;

    OBJECTPERMFIELDS.forEach(function (field) {
        if (get(object_perms, field) === 'true') {
            canAccess = true;
        }
    });

    return canAccess;
}

/**
 * Gets the full names of a metadata type
 * @param {String} type The metadata type
 * @returns {Promise} A promise for the full names of all the metadata
 */
function metadataFullNames(type) {
    return new Promise(function (resolve, reject) {
        metadataList_bound(type)
            .then(function (metadata) {
                const full_names = [];
                metadata_global[type] = keyBy(metadata, FULLNAME);

                metadata.forEach(function (metadata) {
                    full_names.push(metadata.fullName);
                });

                resolve(full_names);
            })
            .catch(reject);
    });
}

/**
 * Gets permission information
 * @param {Object} conn The Salesforce connection
 * @param {String} type The metadata type
 * @returns {Promise} A promise for the permission description
 */
function getPermissions(conn, type) {
    console.info(`Fetching ${type} metadata`);

    return new Promise(function (resolve, reject) {
        const metadataReadAll_bound = sfdc.metadata.readAll.bind(null, conn, type);

        metadataFullNames(type)
            .then(metadataReadAll_bound)
            .then(function (metadata) {
                resolve(metadata);
            }).catch(reject);
    });
}

/**
 * Gets all the profiles that have access to the Salesforce object
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for the profiles
 */
function getProfilePermissions(conn) {
    return new Promise(function (resolve, reject) {
        getPermissions(conn, PROFILE)
            .then(function (metadata) {
                const permissions = [];

                metadata.forEach(function (profile) {
                    const object_perms = get(keyBy(profile.objectPermissions, 'object'), opts.objectName);
                    if (hasAnyAccess(object_perms)) {
                        object_perms.id = metadata_global[PROFILE][profile.fullName].id;
                        permissions.push(object_perms);
                    }
                });

                resolve(permissions);
            })
            .catch(reject);
    });
}

/**
 * Gets all the permission sets that have access to the Salesforce object
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for the permission sets
 */
function getPermSetPermissions(conn) {
    return new Promise(function (resolve, reject) {
        getPermissions(conn, PERMSET)
            .then(function (metadata) {
                const permissions = [];

                metadata.forEach(function (permset) {
                    const object_perms = get(keyBy(permset.objectPermissions, 'object'), opts.objectName);
                    if (hasAnyAccess(object_perms)) {
                        object_perms.id = metadata_global[PERMSET][permset.fullName].id;
                        permissions.push(object_perms);
                    }
                });

                resolve(permissions);
            })
            .catch(reject);
    });
}

/**
 * Gets the permission sets groups that contain the permissions sets
 * @param {Object} permissions The permission data
 * @returns {Promise} A promise for the updated permissions
 */
function findPermissionSetGroups(permissions) {
    console.info(`Fetching permission set groups for ${permissions.permsets.length} permission sets`);

    return new Promise(function (resolve, reject) {
        const permission_set_ids = map(permissions.permsets, ID);

        const query = sfdc.generateQuery(
            PERMSETGROUP_FIELDS,
            PERMSETGROUP,
            [
                `PermissionSetId in (${join(sfdc.quoteStrings(permission_set_ids), ',')})`
            ]
        );

        query_bound(query)
            .then(function (results) {
                permissions.groups = results;
                resolve(permissions);
            })
            .catch(reject);
    });
}

/**
 * Finds the users that are in the permission set groups or have permission sets
 * @param {Object} permissions The permission data
 * @returns {Promise} A promise for the user ids
 */
function getPermissionSetUsers(permissions) {
    console.info(`Found ${permissions.groups.length} permission set groups`);

    return new Promise(function (resolve, reject) {
        const permission_set_ids = map(permissions.permsets, ID);
        const permission_set_group_ids = map(permissions.groups, PERMSETGROUPID);

        const query = sfdc.generateQuery(
            PERMSET_ASSIGNMENT_FIELDS,
            PERMSET_ASSIGNMENT,
            join([
                `${PERMSETGROUPID} in (${join(sfdc.quoteStrings(permission_set_group_ids))})`,
                `PermissionSetId in (${join(sfdc.quoteStrings(permission_set_ids))})`
            ], OR)
        );

        query_bound(query)
            .then(function (results) {
                permissions.permset_assignments = results;
                resolve(permissions);
            })
            .catch(reject);
    });
}

/**
 * Gets the profiles and permission sets that have access to the object
 * @returns {Promise} A promise for the combined profiles and permission sets
 */
function getProfilesAndPermsets() {
    return new Promise(function (resolve, reject) {
        const results = {
            profiles: undefined,
            permsets: undefined,
            groups: undefined
        };

        getProfilePermissions_bound()
            .then(function (profiles) {
                return new Promise(function (profile_resolve) {
                    results.profiles = profiles;
                    profile_resolve();
                });
            })
            .then(getPermSetPermissions_bound)
            .then(function (permsets) {
                return new Promise(function (permset_resolve) {
                    results.permsets = permsets;
                    permset_resolve();
                });
            })
            .then(function () {
                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Gets the users that are explicitly assigned to permission sets or have a profile with access
 * @param {Object} permissions The permissions
 * @returns {Promise} A promise for the users
 */
function getUsers(permissions) {
    const results = {
        users: undefined,
        permissions: permissions
    };

    return new Promise(function (resolve, reject) {
        const user_ids = map(permissions.permset_assignments, ASSIGNEEID);
        const profile_ids = map(permissions.profiles, ID);

        console.info(`Fetching users for ${profile_ids.length} profiles and ${user_ids.length} direct assignments`);

        const query = sfdc.generateQuery(
            USER_FIELDS,
            USER,
            join([
                `Id in (${sfdc.quoteStrings(user_ids)})`,
                `ProfileId in (${sfdc.quoteStrings(profile_ids)})`
            ], OR)
        );

        bulkQuery_bound(query)
            .then(function (users) {
                console.info(`Found ${users.length} users`);
                results.users = users;

                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Collates the user's data and permissions
 * @param {Object} data The data and permissions
 * @returns {Promise} A promise for the user data
 */
function buildDataSet(data) {
    const profile_map = keyBy(data.permissions.profiles, ID);
    const permset_map = keyBy(data.permissions.permsets, ID);
    const group_map = {};
    const assignment_map = {};
    const user_map = {};

    data.permissions.permset_assignments.forEach(function (assignment) {
        if (assignment_map[assignment.AssigneeId] === undefined) {
            assignment_map[assignment.AssigneeId] = [];
        }

        assignment_map[assignment.AssigneeId].push(assignment);
    });

    data.permissions.groups.forEach(function (group) {
        if (group_map[group[PERMSETGROUPID]] === undefined) {
            group_map[group[PERMSETGROUPID]] = [];
        }

        group_map[group[PERMSETGROUPID]].push(group);
    });

    return new Promise(function (resolve) {
        data.users.forEach(function (user) {
            const user_perms = {
                id: user.Id,
                username: user.Username,
                allowCreate: false,
                allowDelete: false,
                allowEdit: false,
                allowRead: false,
                modifyAllRecords: false,
                viewAllRecords: false
            };

            const profile = profile_map[user.ProfileId];

            if (profile) {
                OBJECTPERMFIELDS.forEach(function (field) {
                    if (profile[field] === TRUE) {
                        user_perms[field] = true;
                    }
                });
            }

            const assignments = assignment_map[user.Id];

            if (assignments) {
                assignments.forEach(function (assignment) {
                    if (assignment.PermissionSetGroupId) {
                        const groups = group_map[assignment.PermissionSetGroupId];

                        if (groups) {
                            groups.forEach(function (group) {
                                const permset = permset_map[group.PermissionSetId];

                                if (permset) {
                                    OBJECTPERMFIELDS.forEach(function (field) {
                                        if (permset[field] === TRUE) {
                                            user_perms[field] = true;
                                        }
                                    });
                                }
                            });
                        }
                    } else if (assignment.PermissionSetId) {
                        const permset = permset_map[assignment.PermissionSetId];

                        if (permset) {
                            OBJECTPERMFIELDS.forEach(function (field) {
                                if (permset[field] === TRUE) {
                                    user_perms[field] = true;
                                }
                            });
                        }
                    }
                });
            }

            user_map[user.Id] = user_perms;
        });

        resolve(values(user_map));
    });
}

/**
 * Writes the user data to disk
 * @param {Object[]} users The users to write
 * @returns {Promise} A promise for when the data has been written to disk
 */
function writeCSV(users) {
    const header = [
        {
            id: 'id',
            title: 'id'
        },
        {
            id: 'username',
            title: 'username'
        }
    ];

    OBJECTPERMFIELDS.forEach(function (field) {
        header.push({
            id: field,
            title: field
        });
    });

    const filename = opts.file;

    console.info(`Writing ${users.length} users to ${filename}`);

    return new Promise(function (resolve, reject) {
        fs.access(filename, fs.F_OK, function (error) {
            if (!error && !opts.force) {
                reject(new Error(`${filename} already exists`));
            } else {
                const writer = csvWriter.createObjectCsvWriter({
                    path: filename,
                    header: header
                });
                writer.writeRecords(users)
                    .then(resolve)
                    .catch(reject);
            }
        });
    });
}

/**
 * Gets the users that belong to the profiles or the permission sets
 * @param {Object} permissions The permission data
 * @returns {Promise} A promise for the user information
 */
function findGroupsAndUsers(permissions) {
    console.info(`Found ${permissions.profiles.length} profiles with access`);
    console.info(`Found ${permissions.permsets.length} permission sets with access`);

    return new Promise(function (resolve, reject) {
        findPermissionSetGroups(permissions)
            .then(getPermissionSetUsers)
            .then(getUsers)
            .then(buildDataSet)
            .then(writeCSV)
            .then(resolve)
            .catch(reject);
    });
}

const TIMER = 'Total time';
console.time(TIMER);

solenopsis.login(opts.environment, solenopsis_opts)
    .then(bind)
    .then(getProfilesAndPermsets)
    .then(findGroupsAndUsers)
    .catch(console.error)
    .finally(function () {
        console.timeEnd(TIMER);
    });
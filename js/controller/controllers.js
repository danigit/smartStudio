(function() {
    'use strict';

    //reloading angular module
    let main = angular.module('main');

    //CONTROLLERS
    main.controller('recoverPassController', recoverPassController);
    main.controller('menuController', menuController);
    main.controller('languageController', languageController);

    /**
     * Function that handle the menu interaction
     * @type {string[]}
     */
    menuController.$inject = ['$rootScope', '$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', '$interval', '$mdToast', '$element', 'NgMap', 'dataService', 'newSocketService'];

    function menuController($rootScope, $scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, $interval, $mdToast, $element, NgMap, dataService, newSocketService) {

        $scope.menuTags = dataService.allTags;
        $scope.menuLocationFloors = [];
        $scope.menuAnchors = [];
        $scope.isAdmin = dataService.isAdmin;
        $scope.isUserManager = dataService.isUserManager;
        $scope.selectedTag = '';
        $scope.selectedAnchor = '';
        $scope.selectedLocation = '';
        $scope.zoneColor = '';
        $scope.userRole = '';
        $scope.ctrlDataService = dataService;
        $scope.alertButtonColor = 'background-red';
        $scope.mapFullscreen = false;
        $scope.versionNumber = "";
        $scope.showUpdateField = false;

        $scope.switch = {
            mapFullscreen: false,
            showOutdoorRectDrawing: false,
            showOutdoorRoundDrawing: false
        };

        /**
         * Function that recover all the tags when the search tag select is opened
         */
        $scope.getAllWetags = () => {
            newSocketService.getData('get_all_tags', {}, (response) => {

                $scope.menuTags = response.result;
            });
        };

        /**
         * Function that recover all the floors of the location when the select floor is opened
         */
        $scope.getLocationFloors = () => {
            let location = (dataService.locationFromClick === '') ? dataService.location.name : dataService.locationFromClick;
            newSocketService.getData('get_floors_by_location', { location: location }, (response) => {

                $scope.menuLocationFloors = response.result;
            });
        };

        /**
         * Function that recover all the anchors of the location when the select floor is opened
         */
        $scope.getLocationAnchors = () => {
            let location = (dataService.locationFromClick === '') ? dataService.location.name : dataService.locationFromClick;
            newSocketService.getData('get_anchors_by_location', { location: location }, (response) => {

                $scope.menuAnchors = response.result;
            });
        };

        /**
         * Function that recove the user locations when the search location select is opened
         */
        $scope.getUserLocations = () => {
            newSocketService.getData('get_user_locations', { user: dataService.user.id }, (response) => {

                $scope.locations = response.result;
            });
        };

        /**
         * Function that open and close the menu
         */
        $scope.toggleLeft = () => {
            $mdSidenav('left').toggle();
        };

        /**
         * Function that shows the location table
         */
        $scope.openLocations = () => {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);

            let locationsHasChanged = false;

            let locationDialog = {
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager },
                templateUrl: componentsPath + 'locations-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', function($scope, admin, userManager) {
                    $scope.selected = [];
                    $scope.locationsTable = [];
                    $scope.isAdmin = admin;
                    $scope.isOrdered = dataService.switch.showTableSorting;
                    $scope.isUserManager = userManager;
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    $scope.items = ['name', 'latitude', 'longitude', 'radius', 'meter_radius'];
                    $scope.columns = [];

                    /**
                     * Function that recover the locations
                     */
                    let updateLocationTable = () => {
                        newSocketService.getData('get_locations_by_user', { user: dataService.user.username }, (response) => {

                            $scope.locationsTable = response.result;
                            $scope.$apply();
                        });
                    };

                    updateLocationTable();

                    $rootScope.$on('updateLocationTable', function() {
                        updateLocationTable()
                    });

                    /**
                     * Functionn that modifies a cell of the table
                     * @param event
                     * @param location
                     * @param locationName
                     */
                    $scope.editCell = (event, location, locationName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: location[locationName],
                                save: function(input) {
                                    input.$invalid = true;
                                    location[locationName] = input.$modelValue;
                                    newSocketService.getData('change_location_field', {
                                        location_id: location.id,
                                        location_field: locationName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        if (response.result !== 1) {
                                            locationsHasChanged = true;
                                            dataService.showToast($mdToast, lang.fieldNotChanged, 'background-darkred', 'color-white');
                                        } else {
                                            dataService.showToast($mdToast, lang.fieldChanged, 'background-lightgreen', 'color-black');
                                        }
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': TABLE_CELL_MAX_LENGTH
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting a location
                    /**
                     * Fuction that deletes a cell of the table
                     * @param location
                     */
                    $scope.deleteRow = (location) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteSite.toUpperCase())
                            .textContent(lang.okDeleteSite)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteSite.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_location', { location_id: location.id }, (response) => {

                                if (response.result.length === 0) {
                                    $scope.locationsTable = $scope.locationsTable.filter(t => t.id !== location.id);
                                    locationsHasChanged = true;
                                    $scope.$apply();
                                    dataService.showToast($mdToast, lang.elementDeleted, 'background-lightgreen', 'color-black');
                                } else {
                                    dataService.showToast($mdToast, lang.elementNotDeleted, 'background-darkred', 'color-white');
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addLocationDialog);
                    };

                    /**
                     * Function that show hide the columns of the table
                     * @param item
                     * @param list
                     */
                    $scope.toggle = function(item, list) {
                        console.log(list);
                        let idx = list.indexOf(item);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        } else {
                            list.push(item);
                        }
                    };

                    /**
                     * Function that sets the label of the select column field
                     * @returns {string}
                     */
                    $scope.getName = () => {
                        return lang.columns
                    };

                    /**
                     * Function that control if a column must be displayed
                     * @param item
                     * @param list
                     * @returns {boolean}
                     */
                    $scope.exists = function(item, list) {
                        return list.indexOf(item) > -1;
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.homeTimer === undefined && !locationsHasChanged) {
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                    if (locationsHasChanged) {
                        locationsHasChanged = false;
                        window.location.reload();
                    }
                }
            };

            $mdDialog.show(locationDialog);

            /**
             * Add row window
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, function(*=): void], multiple: boolean, templateUrl: string}}
             */
            let addLocationDialog = {
                templateUrl: componentsPath + 'insert-location.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    let fileInput = null;

                    $scope.location = {
                        name: '',
                        description: '',
                        latitude: '',
                        longitude: '',
                        radius: '',
                        meterRadius: '',
                        showSuccess: false,
                        showError: false,
                        isIndoor: false,
                        message: '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertLocation = (form) => {
                        form.$submitted = true;

                        // control if the form is valid
                        if (form.$valid) {
                            let file = null;
                            let fileName = null;

                            // controll if the file is selected
                            if (fileInput != null && fileInput.files.length !== 0) {
                                file = fileInput.files[0];
                                fileName = file.name;
                            }

                            // updating the database
                            newSocketService.getData('insert_location', {
                                user: dataService.user.id,
                                name: $scope.location.name,
                                description: $scope.location.description,
                                latitude: $scope.location.latitude,
                                longitude: $scope.location.longitude,
                                imageName: (fileName === null) ? '' : fileName,
                                radius: ($scope.location.isIndoor) ? '' : ($scope.location.radius === '') ? 0 : $scope.location.radius,
                                meterRadius: ($scope.location.isIndoor) ? '' : ($scope.location.radius === '') ? 0 : $scope.location.meterRadius,
                                is_indoor: $scope.location.isIndoor
                            }, (response) => {

                                // controlling the result
                                if (response.result.length === 0) {
                                    if (file != null) {
                                        convertImageToBase64(file)
                                            .then((images) => {
                                                if (images !== null) {
                                                    newSocketService.getData('save_marker_image', {
                                                        imageName: fileName,
                                                        image: images
                                                    }, (savedImage) => {
                                                        if (savedImage.result === false) {
                                                            locationsHasChanged = true;
                                                            $scope.location.showSuccess = false;
                                                            $scope.location.showError = true;
                                                            $scope.location.message = lang.positionInsertedWithoutImage;
                                                            $scope.location.resultClass = 'background-orange';
                                                            $rootScope.$emit('updateLocationTable', {});
                                                            $scope.$apply();

                                                            dataService.showToast($mdToast, lang.elementInserted, 'background-lightgreen', 'color-black');
                                                            $timeout(function() {
                                                                $mdDialog.hide();
                                                            }, 1000);
                                                        } else {
                                                            locationsHasChanged = true;
                                                            $scope.location.resultClass = 'background-green';
                                                            $scope.location.showSuccess = true;
                                                            $scope.location.showError = false;
                                                            $scope.location.message = lang.positionInserted;
                                                            $rootScope.$emit('updateLocationTable', {});
                                                            $scope.$apply();

                                                            dataService.showToast($mdToast, lang.elementInserted, 'background-lightgreen', 'color-black');
                                                            $timeout(function() {
                                                                $mdDialog.hide();
                                                            }, 1000);
                                                        }
                                                    });
                                                }
                                            })
                                    } else {
                                        locationsHasChanged = true;
                                        $scope.location.showSuccess = true;
                                        $scope.location.showError = false;
                                        $scope.location.message = lang.positionInsertedWithoutImage;
                                        $scope.location.resultClass = 'background-orange';
                                        $rootScope.$emit('updateLocationTable', {});
                                        $scope.$apply();

                                        dataService.showToast($mdToast, lang.elementInserted, 'background-lightgreen', 'color-black');
                                        $timeout(function() {
                                            $mdDialog.hide();
                                        }, 1000);
                                    }
                                } else {
                                    $scope.location.showSuccess = false;
                                    $scope.location.showError = true;
                                    $scope.location.message = lang.impossibleToInsertPosition;
                                    $scope.location.resultClass = 'background-red';
                                    $scope.$apply();

                                    dataService.showToast($mdToast, lang.elementNotInserted, 'background-darkred', 'color-white');
                                    return null
                                }
                            });
                        } else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadMarkerImage = () => {
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            }
        };

        $scope.openUserManager = function() {
            $interval.cancel(dataService.homeTimer);
            dataService.homeTimer = undefined;
            let usersDialog = {
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager },
                templateUrl: componentsPath + 'users-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', 'dataService', function($scope, admin, userManager, dataService) {
                    $scope.title = "UTENTI";
                    $scope.selected = [];
                    $scope.usersTable = [];
                    $scope.isAdmin = admin;
                    $scope.isUserManager = userManager;
                    $scope.tableEmpty = false;
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    let updateIntermediateUserTable = () => {
                        newSocketService.getData('get_generic_users', {}, (response) => {

                            $scope.usersTable = response.result;
                            $scope.tableEmpty = $scope.usersTable.length === 0;
                            $scope.$apply();
                        });
                    };

                    updateIntermediateUserTable();

                    $rootScope.$on('updateIntermediateUserTable', function() {
                        updateIntermediateUserTable()
                    });

                    $scope.manageLocations = (user) => {
                        let manageLocationDialog = {
                            locals: { user: user },
                            templateUrl: componentsPath + 'manage-locations.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', 'user', function($scope, user) {

                                $scope.locations = [];
                                $scope.tableEmpty = false;
                                $scope.query = {
                                    limitOptions: [500, 15, 10, 5],
                                    limit: dataService.switch.showTableSorting ? 500 : 5,
                                    page: 1
                                };

                                newSocketService.getData('get_user_locations', { user: user.id }, (response) => {

                                    $scope.locations = response.result;
                                    $scope.tableEmpty = $scope.locations.length === 0;
                                });

                                /**
                                 * Function that handle the selection of the locations
                                 */
                                $scope.manageNewLocation = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        templateUrl: componentsPath + 'insert-managed-location.html',
                                        parent: angular.element(document.body),
                                        targetEvent: event,
                                        clickOutsideToClose: true,
                                        multiple: true,
                                        controller: ['$scope', function($scope) {


                                            let locationsIds = [];

                                            $scope.insertManagedLocations = {
                                                resultClass: '',
                                                selectedLocations: [],
                                                allLocations: []
                                            };

                                            newSocketService.getData('get_all_locations', {}, (response) => {

                                                $scope.insertManagedLocations.allLocations = response.result;
                                            });

                                            /**
                                             * Function
                                             * @param form
                                             */
                                            $scope.addManagedLocation = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedLocations.allLocations.filter(l => $scope.insertManagedLocations.selectedLocations.some(sl => sl === l.name))
                                                        .forEach((location) => {
                                                            locationsIds.push(location.id);
                                                        });

                                                    newSocketService.getData('insert_managed_location', {
                                                        user: user.id,
                                                        locations: locationsIds,
                                                    }, (response) => {

                                                        if (Number.isInteger(response.result)) {
                                                            dataService.showToast($mdToast, lang.elementInserted, 'background-lightgreen', 'color-black');

                                                            $mdDialog.hide();
                                                            $mdDialog.show(manageLocationDialog);
                                                        } else {
                                                            dataService.showToast($mdToast, lang.elementNotInserted, 'background-darkred', 'color-white');
                                                        }
                                                    });
                                                } else {
                                                    $scope.insertManagedLocations.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                //deleting tag
                                $scope.deleteManagedLocation = (location) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteLocation.toUpperCase())
                                        .textContent(lang.deleteLocationText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteLocation)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        newSocketService.getData('delete_managed_location', {
                                            user: user.id,
                                            location_id: location.id
                                        }, (response) => {
                                            if (response.result === 1) {
                                                dataService.showToast($mdToast, lang.elementDeleted, 'background-lightgreen', 'color-black');

                                                $scope.locations = $scope.locations.filter(l => l.id !== location.id);
                                                $scope.$apply();
                                            } else {
                                                dataService.showToast($mdToast, lang.elementNotDeleted, 'background-darkred', 'color-white');
                                            }
                                        });
                                    }, function() {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(manageLocationDialog);
                    };

                    $scope.editCell = (event, user, userName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: user[userName],
                                save: function(input) {
                                    input.$invalid = true;
                                    user[userName] = input.$modelValue;
                                    newSocketService.getData('change_user_field', {
                                        user_id: user.id,
                                        user_field: userName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        log(response.result);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //deleting a location
                    $scope.deleteRow = (user) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.cancelUser.toUpperCase())
                            .textContent(lang.cancelUserText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.cancelUser)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_user', { user_id: user.id }, (response) => {
                                if (!response.session_state)
                                    window.location.reload();

                                if (response.result !== 0) {
                                    $scope.usersTable = $scope.usersTable.filter(u => u.id !== user.id);
                                    $scope.$apply();
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addUserDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.homeTimer === undefined) {
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                }
            };

            $mdDialog.show(usersDialog);

            let addUserDialog = {
                templateUrl: componentsPath + 'insert-user.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    $scope.user = {
                        username: '',
                        name: '',
                        email: '',
                        showSuccess: false,
                        showError: false,
                        isIndoor: false,
                        message: '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertUser = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            newSocketService.getData('insert_user', {
                                username: $scope.user.username,
                                name: $scope.user.name,
                                email: $scope.user.email
                            }, (response) => {
                                if (!response.session_state)
                                    window.location.reload();

                                if (response.result.length === 0) {
                                    $scope.user.resultClass = 'background-green';
                                    $scope.user.showSuccess = true;
                                    $scope.user.showError = false;
                                    $scope.user.message = lang.userInserted;

                                    $scope.$apply();

                                    $timeout(function() {
                                        $mdDialog.hide();
                                        $rootScope.$emit('updateIntermediateUserTable', {});
                                    }, 1000);
                                } else {
                                    $scope.user.showSuccess = false;
                                    $scope.user.showError = true;
                                    $scope.user.message = lang.canInsertUser;
                                    $scope.user.resultClass = 'background-red';
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.user.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            }
        };

        /**
         * Function that shows the super user table
         */
        $scope.openSuperuserManager = function() {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);

            let userId = null;
            let usersTable = [];
            let superUsersDialog = {
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager },
                templateUrl: componentsPath + 'users-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', function($scope, admin, userManager) {
                    $scope.title = lang.users.toUpperCase();
                    $scope.selected = [];
                    $scope.usersTable = [];
                    $scope.isAdmin = admin;
                    $scope.userRole = '';
                    $scope.isUserManager = userManager;
                    $scope.showColumn = true;
                    $scope.items = ['username', 'name', 'role', 'phone', 'url_bot', 'bot_id', 'email_alert', 'webservice_url'];
                    $scope.columns = [];
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    $scope.showColumn = () => {
                        $scope.showColumn = false;
                    };

                    /**
                     * Function that changes the user role
                     * @param user
                     * @param userRole
                     */
                    $scope.updateUserRole = (user, userRole) => {
                        if (user.role !== userRole.toString()) {
                            newSocketService.getData('update_user_role', {
                                user: user.id,
                                role: userRole
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result === 1);
                            });
                        }
                    };

                    /**
                     * Function that retrieve the users
                     */
                    let updateSuperuserTable = () => {
                        newSocketService.getData('get_all_users', {}, (response) => {

                            $scope.usersTable = response.result;
                            $scope.$apply();
                        })
                    };

                    updateSuperuserTable();

                    $rootScope.$on('updateSuperuserTable', function() {
                        updateSuperuserTable()
                    });

                    /**
                     * Function that manages the locations of the user
                     * @param user
                     */
                    $scope.manageLocations = (user) => {
                        userId = user.id;

                        let manageLocationDialog = {
                            locals: { user: user },
                            templateUrl: componentsPath + 'manage-locations.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', 'user', function($scope, user) {

                                $scope.locations = [];
                                $scope.user = user;

                                $scope.tableEmpty = false;
                                $scope.query = {
                                    limitOptions: [500, 15, 10, 5],
                                    limit: dataService.switch.showTableSorting ? 500 : 5,
                                    page: 1
                                };

                                newSocketService.getData('get_user_locations', { user: user.id }, (response) => {

                                    $scope.locations = response.result;
                                });

                                /**
                                 * Function that assign new locations to the user
                                 */
                                $scope.manageNewLocation = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        templateUrl: componentsPath + 'insert-managed-location.html',
                                        parent: angular.element(document.body),
                                        targetEvent: event,
                                        clickOutsideToClose: true,
                                        multiple: true,
                                        controller: ['$scope', function($scope) {


                                            let locationsIds = [];

                                            $scope.insertManagedLocations = {
                                                resultClass: '',
                                                selectedLocations: [],
                                                allLocations: []
                                            };

                                            // getting all the locations
                                            newSocketService.getData('get_all_locations', {}, (response) => {

                                                $scope.insertManagedLocations.allLocations = response.result;
                                            });

                                            /**
                                             * Function that inserts the selected locations in the list of the user locations
                                             * @param form
                                             */
                                            $scope.addManagedLocation = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedLocations.allLocations.filter(l => $scope.insertManagedLocations.selectedLocations.some(sl => sl === l.name))
                                                        .forEach((location) => {
                                                            locationsIds.push(location.id);
                                                        });

                                                    // changing the user locations on the database
                                                    newSocketService.getData('insert_managed_location', {
                                                        user: user.id,
                                                        locations: locationsIds,

                                                    }, (response) => {
                                                        dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result !== 0);

                                                        $mdDialog.hide();
                                                        $mdDialog.show(manageLocationDialog);
                                                    });
                                                } else {
                                                    $scope.insertManagedLocations.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                /**
                                 * Fuction that deletes a location from the user locations
                                 * @param location
                                 */
                                $scope.deleteManagedLocation = (location) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteLocation.toUpperCase())
                                        .textContent(lang.deleteLocationText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteLocation)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        newSocketService.getData('delete_managed_location', {
                                            user: user.id,
                                            location_id: location.id
                                        }, (response) => {
                                            dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result !== 0);
                                            if (response.result === 1) {
                                                $scope.locations = $scope.locations.filter(l => l.id !== location.id);
                                                $scope.$apply();
                                            }
                                        });
                                    }, function() {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(manageLocationDialog);
                    };


                    /**
                     * Function that modify a cell of the table
                     * @param event
                     * @param superUser
                     * @param superUserName
                     */
                    $scope.editCell = (event, superUser, superUserName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: superUser[superUserName],
                                save: function(input) {
                                    input.$invalid = true;
                                    superUser[superUserName] = input.$modelValue;
                                    newSocketService.getData('change_super_user_field', {
                                        super_user_id: superUser.id,
                                        super_user_field: superUserName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result !== 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Function that deletes a user
                     * @param user
                     */
                    $scope.deleteRow = (user) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.cancelUser.toUpperCase())
                            .textContent(lang.cancelUserText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.cancelUser)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_super_user', { user_id: user.id }, (response) => {
                                dataService.showMessage($mdToast, lang.userDeleted, lang.userNotDeleted, response.result !== 0);

                                if (response.result !== 0) {
                                    $scope.usersTable = $scope.usersTable.filter(u => u.id !== user.id);
                                    $scope.$apply();
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addSuperUserDialog);
                    };

                    /**
                     * Function that show hide the columns of the table
                     * @param item
                     * @param list
                     */
                    $scope.toggle = function(item, list) {
                        console.log(list);
                        let idx = list.indexOf(item);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        } else {
                            list.push(item);
                        }
                    };

                    /**
                     * Function that sets the label of the select column field
                     * @returns {string}
                     */
                    $scope.getName = () => {
                        return lang.columns
                    };

                    /**
                     * Function that control if a column must be displayed
                     * @param item
                     * @param list
                     * @returns {boolean}
                     */
                    $scope.exists = function(item, list) {
                        return list.indexOf(item) > -1;
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.homeTimer === undefined) {
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                }
            };

            $mdDialog.show(superUsersDialog);

            let addSuperUserDialog = {
                templateUrl: componentsPath + 'insert-super-user.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    let emailList = [];

                    $scope.roles = [lang.genericUser, lang.intermediateUser, lang.trackerUser];
                    $scope.userRoleRegister = { registerRole: '' };
                    $scope.user = {
                        username: '',
                        name: '',
                        email: '',
                        phone: '',
                        emailForList: '',
                        botUrl: '',
                        chatId: '',
                        webUrl: '',
                        showSuccess: false,
                        showError: false,
                        isIndoor: false,
                        message: '',
                        resultClass: ''
                    };

                    $scope.addEmail = () => {
                        emailList.push($scope.user.emailForList);
                    };

                    //insert location dialog
                    $scope.insertUser = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            newSocketService.getData('insert_super_user', {
                                username_reg: $scope.user.username,
                                name: $scope.user.name,
                                email: $scope.user.email,
                                phone: $scope.user.phone,
                                emailList: emailList,
                                botUrl: $scope.user.botUrl,
                                chatId: $scope.user.chatId,
                                webUrl: $scope.user.webUrl,
                                role: $scope.userRoleRegister.registerRole
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.userDeleted, lang.userNotDeleted, response.result.length === 0);

                                if (response.result.length === 0) {
                                    $scope.user.resultClass = 'background-green';
                                    $scope.user.showSuccess = true;
                                    $scope.user.showError = false;
                                    $scope.user.message = lang.userInserted;

                                    $rootScope.$emit('updateSuperuserTable', {});
                                    $scope.$apply();

                                    $timeout(function() {
                                        $mdDialog.hide();
                                    }, 1000);
                                } else {
                                    $scope.user.showSuccess = false;
                                    $scope.user.showError = true;
                                    $scope.user.message = lang.canInsertUser;
                                    $scope.user.resultClass = 'background-red';
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.user.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    // if (dataService.superUsersInterval === undefined)
                    //     $rootScope.$emit('updateUserTable', {});
                }
            }
        };

        /**
         * Function that shows the tracking table
         */
        $scope.viewTracking = function() {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);

            $mdDialog.show({
                templateUrl: componentsPath + 'tracking-table.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                controller: ['$scope', function($scope) {
                    let from = new Date();
                    from.setDate(from.getDate() - 7);

                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.tracking = {
                        fromDate: from,
                        toDate: new Date(),
                        tags: dataService.allTags,
                        events: null,
                        selectedTag: null,
                        selectedEvent: null
                    };

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'time',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    $scope.trackingRows = [];

                    $scope.$watchGroup(['tracking.fromDate', 'tracking.toDate', 'tracking.selectedTag', 'tracking.selectedEvent'], function(newValues) {
                        let fromDate = $filter('date')(newValues[0], 'yyyy-MM-dd');
                        let toDate = $filter('date')(newValues[1], 'yyyy-MM-dd');


                        newSocketService.getData('get_events', {}, (response) => {

                            $scope.tracking.events = response.result;
                        });

                        newSocketService.getData('get_tracking', {
                            fromDate: fromDate,
                            toDate: toDate,
                            tag: newValues[2],
                            event: newValues[3]
                        }, (response) => {

                            $scope.trackingRows = dataService.getProtocol(response.result);
                            $scope.$apply();
                        });
                    });

                    $scope.hide = () => {

                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.homeTimer === undefined) {
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map)
                        });
                    }
                }
            });
        };

        /**
         * Function that shows the history table
         * @param position
         */
        $scope.viewHistory = function(position) {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            $mdDialog.show({
                templateUrl: componentsPath + 'history-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function($scope) {
                    let from = new Date();
                    from.setDate(from.getDate() - 7);

                    $scope.tableEmpty = false;
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.history = {
                        fromDate: from,
                        toDate: new Date(),
                        tags: dataService.allTags,
                        events: null,
                        selectedTag: null,
                        selectedEvent: null
                    };

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'time',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    $scope.historyRows = [];

                    /**
                     * Function that deletes the history
                     */
                    $scope.deleteHistory = () => {
                        let fromDate = $filter('date')($scope.history.fromDate, 'yyyy-MM-dd');
                        let toDate = $filter('date')($scope.history.toDate, 'yyyy-MM-dd');

                        newSocketService.getData('delete_history', { fromDate: fromDate, toDate: toDate }, (response) => {

                            if (response.result !== 0) {
                                //TODO add toast
                                newSocketService.getData('get_history', {
                                    fromDate: fromDate,
                                    toDate: toDate,
                                    tag: $scope.history.selectedTag,
                                    event: $scope.history.selectedEvent
                                }, (history) => {
                                    //TODO add toast
                                    $scope.historyRows = dataService.getProtocol(history.result);
                                    $scope.tableEmpty = $scope.historyRows.length === 0;
                                    $scope.$apply();
                                });
                            }
                        });
                    };

                    $scope.$watchGroup(['history.fromDate', 'history.toDate', 'history.selectedTag', 'history.selectedEvent'], function(newValues) {
                        let fromDate = $filter('date')(newValues[0], 'yyyy-MM-dd');
                        let toDate = $filter('date')(newValues[1], 'yyyy-MM-dd');


                        newSocketService.getData('get_events', {}, (response) => {

                            $scope.history.events = response.result;
                        });

                        newSocketService.getData('get_history', {
                            fromDate: fromDate,
                            toDate: toDate,
                            tag: newValues[2],
                            event: newValues[3]
                        }, (response) => {

                            $scope.historyRows = dataService.getProtocol(response.result);
                            $scope.query['limitOptions'] = [500, 15, 10, 5];
                            $scope.query['limitOptions'].push(response.result.length);

                            newSocketService.getData('get_all_locations', {}, (locations) => {
                                $scope.historyRows.forEach((event, index) => {
                                    if (event.tag_x_pos !== -1 && event.tag_y_pos !== -1 &&
                                        event.tag_x_pos !== -2 && event.tag_y_pos !== -2 &&
                                        event.tag_x_pos !== 0 && event.tag_y_pos !== 0) {
                                        let tagLocation = dataService.getOutdoorTagLocation(locations.result, {
                                            gps_north_degree: event.tag_x_pos,
                                            gps_east_degree: event.tag_y_pos
                                        })[0];
                                        if (tagLocation !== undefined) {
                                            $scope.historyRows[index].location = tagLocation.name;
                                        }
                                    }
                                });
                            });

                            $scope.$apply();
                        });
                    });

                    /**
                     * Function that save the history table in a xml file
                     */
                    $scope.saveHistory = () => {
                        let blob = new Blob([document.getElementById('his-table').innerHTML], {
                            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
                        });

                        let date = new Date();
                        saveAs(blob, "Smart_Studio_history_" + date.getDate() + "_" + (date.getMonth() + 1) + "_" + date.getFullYear() + ".xls");
                    };

                    $scope.hide = () => {

                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    switch (position) {
                        case 'home':
                            if (dataService.homeTimer === undefined) {
                                NgMap.getMap('main-map').then((map) => {
                                    $rootScope.$emit('constantUpdateNotifications', map)
                                });
                            }
                            break;
                        case 'canvas':
                            if (dataService.canvasInterval === undefined) {
                                $rootScope.$emit('constantUpdateCanvas')
                            }
                            break;
                    }
                }
            });
        };

        /**
         * Function thet shows the versions table
         */
        $scope.viewVersions = () => {
            $mdDialog.show({
                templateUrl: componentsPath + 'versions.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function($scope) {

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]

            });
        };

        /**
         * Function thet shows the field for updating the version
         */
        $scope.updateVersion = () => {
            newSocketService.getData('get_version', {}, (response) => {
                $scope.versionNumber = response.result !== "" ? response.result : lang.versionNotFound
                $scope.showUpdateField = true
            });
        };

        /**
         * Functioins that save the version on the database
         */
        $scope.sendVersion = () => {
            newSocketService.getData('update_version', { version: $scope.versionNumber }, (response) => {
                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result.length !== 0);
                $scope.showUpdateField = false;
            });
        }

        /**
         * Function that change the password
         */
        $scope.changePassword = () => {
            $mdDialog.show({
                templateUrl: componentsPath + 'change-password.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function($scope) {
                    $scope.title = lang.changePassword;
                    $scope.changePassword = {
                        oldPassword: '',
                        newPassword: '',
                        reNewPassword: '',
                        resultClass: '',
                        showSuccess: false,
                        showError: false,
                        message: false
                    };

                    $scope.sendPassword = (form) => {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword) {
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.showError = true;
                            $scope.changePassword.showSuccess = false;
                            $scope.changePassword.message = lang.passwordNotEqual;
                        } else {
                            if (form.$valid) {

                                newSocketService.getData('change_password', {
                                    oldPassword: $scope.changePassword.oldPassword,
                                    newPassword: $scope.changePassword.newPassword
                                }, (response) => {
                                    //TODO add toast
                                    if (response.result === 'wrong_old') {
                                        $scope.changePassword.resultClass = 'background-red';
                                        $scope.changePassword.showError = true;
                                        $scope.changePassword.showSuccess = false;
                                        $scope.changePassword.message = lang.invalidOld;
                                    } else if (response.result === 'error_on_changing_password') {
                                        $scope.changePassword.resultClass = 'background-red';
                                        $scope.changePassword.showSuccess = false;
                                        $scope.changePassword.showError = true;
                                        $scope.changePassword.message = lang.impossibleChangePassword;
                                        $timeout(function() {
                                            $mdDialog.hide();
                                        }, 1000);
                                    } else {
                                        $scope.changePassword.resultClass = 'background-green';
                                        $scope.changePassword.showSuccess = true;
                                        $scope.changePassword.showError = false;
                                        $scope.changePassword.message = lang.passwordChanged;
                                        $timeout(function() {
                                            $mdDialog.hide();
                                        }, 1000);
                                    }
                                    $scope.$apply();
                                });
                            } else {
                                $scope.changePassword.resultClass = 'background-red';
                            }
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            });
        };

        /**
         * Function that shows the tags table
         * @param position
         */
        $scope.registry = (position) => {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);

            $scope.clickedTag = null;

            /**
             * Object that inserts a new tag
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, function(*=): void], multiple: boolean, templateUrl: string}}
             */
            let addRowDialog = {
                templateUrl: componentsPath + 'insert-tags-row.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {

                    $scope.tagTypes = [];
                    $scope.selectedType = '';
                    $scope.insertTag = {
                        name: '',
                        type: '',
                        mac: '',
                        resultClass: '',
                    };

                    let macs = [];

                    newSocketService.getData('get_all_types', {}, (response) => {
                        if (!response.session_state)
                            window.location.reload();

                        $scope.tagTypes = response.result;
                    });

                    //insert a tag
                    $scope.addTag = function(form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            newSocketService.getData('insert_tag', {
                                name: $scope.insertTag.name,
                                type: $scope.insertTag.type,
                                macs: macs
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result.length === 0);

                                if (response.result.length === 0) {
                                    $scope.insertTag.resultClass = 'background-green';
                                    $timeout(function() {
                                        $mdDialog.hide();
                                        $rootScope.$emit('updateTagsTable', {});
                                    }, 1000);
                                }
                            });
                        } else {
                            $scope.insertTag.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that show the tags table
             */
            let registryDialog = {
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager, position: position },
                templateUrl: componentsPath + 'tags-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', 'position', function($scope, admin, userManager, position) {
                    $scope.selected = [];
                    $scope.tags = [];
                    $scope.tableEmpty = false;
                    $scope.tagsOnline = [];
                    $scope.isAdmin = admin;
                    $scope.isHome = position === 'home';
                    $scope.isUserManager = userManager;
                    $scope.selectedType = null;
                    $scope.tagTypes = [];
                    $scope.tagsCallMe = {};
                    $scope.items = ['name', 'type', 'battery', 'macs', 'zones', 'parameters', 'callme'];
                    $scope.columns = [];
                    let call_me_button = false;

                    console.log(dataService.switch.showTableSorting);
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Fuction that updates the tags table
                     */
                    let updateTagsTable = () => {
                        newSocketService.getData('get_all_tags', {}, (response) => {

                            $scope.tags = response.result;

                            response.result.forEach(function(tag) {
                                let tagId = tag.id;
                                $scope.tagsCallMe[tagId] = {
                                    background: (tag.call_me_alarm === 1) ? 'color-darkgreen' : 'color-darkred',
                                    value: (tag.call_me_alarm === 1) ? lang.stopCallMe : lang.callMe,
                                    on: (tag.call_me_alarm === 1)
                                }
                            });
                        });

                        newSocketService.getData('get_all_types', {}, (response) => {

                            $scope.tagTypes = response.result;
                        });
                    };

                    /**
                     * Fuction that controls if the tag i turned off
                     * @param tag
                     * @returns {*}
                     */
                    $scope.isTagOff = (tag) => {
                        return tag.radio_switched_off
                    };

                    /**
                     * Function that controlls if the tag has alarms
                     * @param tag
                     * @returns {string|*}
                     */
                    $scope.tagHasAlarm = (tag) => {
                        return dataService.checkIfTagHasAlarm(tag);
                    };

                    /**
                     * Function that controls if the tag is offline
                     * @param tag
                     * @returns {*}
                     */
                    $scope.isTagOffline = (tag) => {
                        return dataService.isTagOffline(tag);
                    };

                    updateTagsTable();

                    $rootScope.$on('updateTagsTable', function() {
                        updateTagsTable();
                    });

                    /**
                     * Function that update the tag type
                     * @param tag
                     * @param selectedType
                     */
                    $scope.updateTagType = (tag, selectedType) => {
                        if (tag.type_id.toString() !== selectedType.toString()) {
                            newSocketService.getData('update_tag_type', {
                                tag: tag.id,
                                type: selectedType
                            }, (response) => {
                                //TODO add toast
                            });
                        }
                    };

                    /**
                     * Function that modify a cell in the table
                     */
                    $scope.editCell = (event, tag, tagName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: tag[tagName],
                                save: function(input) {
                                    input.$invalid = true;
                                    tag[tagName] = input.$modelValue;
                                    newSocketService.getData('change_tag_field', {
                                        tag_id: tag.id,
                                        tag_field: tagName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result.length === 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Funtion that deletes a tag from the table
                     * @param tag
                     */
                    $scope.deleteRow = (tag) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteTag.toUpperCase())
                            .textContent(lang.okDeleteTag)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteTag.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_tag', { tag_id: tag.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result.length === 0);

                                if (response.result.length === 0) {
                                    $scope.tags = $scope.tags.filter(t => t.id !== tag.id);
                                    $scope.$apply();
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    /**
                     * Function that handle the macs of the tag
                     * @param tag
                     */
                    $scope.tagMacs = (tag) => {
                        $scope.clickedTag = tag;
                        let tagMacsDialog = {
                            locals: { tag: tag },
                            templateUrl: componentsPath + 'insert-tag-mac.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', 'tag', function($scope, tag) {

                                $scope.macs = [];
                                $scope.tag = tag;

                                $scope.query = {
                                    limitOptions: [500, 15, 10, 5],
                                    order: 'name',
                                    limit: dataService.switch.showTableSorting ? 500 : 5,
                                    page: 1
                                };

                                newSocketService.getData('get_tag_macs', { tag: tag.id }, (response) => {

                                    $scope.macs = response.result;
                                });

                                /**
                                 * Function that deletes a tag mac
                                 * @param event
                                 * @param mac
                                 */
                                $scope.deleteMac = (event, mac) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteMac.toUpperCase())
                                        .textContent(lang.okDeleteMac)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteMac.toUpperCase())
                                        .cancel(lang.cancel.toUpperCase());

                                    $mdDialog.show(confirm).then(function() {
                                        newSocketService.getData('delete_mac', { mac_id: mac.id }, (response) => {
                                            dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);

                                            if (response.result !== 0) {
                                                $scope.macs = $scope.macs.filter(m => m.id !== mac.id);
                                                $scope.$apply();
                                            }
                                        });
                                    }, function() {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                /**
                                 * Function that handle the mac insertion
                                 */
                                $scope.addNewMac = () => {
                                    $mdDialog.show({
                                        locals: { tag: tag },
                                        templateUrl: componentsPath + 'insert-mac-row.html',
                                        parent: angular.element(document.body),
                                        targetEvent: event,
                                        clickOutsideToClose: true,
                                        multiple: true,
                                        controller: ['$scope', function($scope) {

                                            $scope.insertMac = {
                                                name: '',
                                                type: '',
                                                resultClass: ''
                                            };

                                            /**
                                             * Function that insert a new tag mac
                                             * @param form
                                             */
                                            $scope.addMac = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {
                                                    newSocketService.getData('insert_mac', {
                                                        name: $scope.insertMac.name,
                                                        type: $scope.insertMac.type,
                                                        tag_id: tag.id
                                                    }, (response) => {

                                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                                        if (response.result !== 0) {
                                                            $scope.insertMac.resultClass = 'background-green';
                                                            $timeout(function() {
                                                                $mdDialog.hide();
                                                                $mdDialog.hide(tagMacsDialog);
                                                                $mdDialog.show(tagMacsDialog);
                                                            }, 1000);
                                                            $scope.$apply();
                                                        } else {
                                                            $scope.insertTag.resultClass = 'background-red';
                                                        }
                                                    });
                                                } else {
                                                    $scope.insertTag.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                /**
                                 * Function that modify a cell of the table
                                 * @param event
                                 * @param mac
                                 * @param macName
                                 */
                                $scope.editCell = (event, mac, macName) => {

                                    event.stopPropagation();

                                    if (admin) {
                                        let editCell = {
                                            modelValue: mac[macName],
                                            save: function(input) {
                                                input.$invalid = true;
                                                mac[macName] = input.$modelValue;
                                                newSocketService.getData('change_mac_field', {
                                                    mac_id: mac.id,
                                                    mac_field: macName,
                                                    field_value: input.$modelValue
                                                }, (response) => {
                                                    dataService.showMessage($mdToast, lang.fieldChanged, lang.fieldNotChanged, response.result !== 0);
                                                });
                                            },
                                            targetEvent: event,
                                            title: lang.insertValue,
                                            validators: {
                                                'md-maxlength': 500
                                            }
                                        };

                                        $mdEditDialog.large(editCell);
                                    }
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(tagMacsDialog);
                    };

                    /**
                     * Function that handle the tag zones
                     * @param tag
                     */
                    $scope.tagZones = (tag) => {
                        let tagZonesDialog = {
                            locals: { tag: tag },
                            templateUrl: componentsPath + 'manage-zones.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', 'tag', function($scope, tag) {

                                $scope.zones = [];
                                $scope.position = position === 'home';
                                $scope.tableEmpty = false;

                                $scope.query = {
                                    limitOptions: [500, 15, 10, 5],
                                    order: 'name',
                                    limit: dataService.switch.showTableSorting ? 500 : 5,
                                    page: 1
                                };

                                newSocketService.getData('get_forbidden_zones', { tag_id: tag.id }, (response) => {

                                    $scope.tableEmpty = response.result.length === 0;
                                    $scope.zones = response.result;
                                });

                                /**
                                 * Function that manages the insertion of a new zone
                                 */
                                $scope.manageNewZone = () => {
                                    $mdDialog.hide();
                                    $mdDialog.show({
                                        locals: { tag: tag, zones: $scope.zones },
                                        templateUrl: componentsPath + 'insert-managed-zones.html',
                                        parent: angular.element(document.body),
                                        targetEvent: event,
                                        clickOutsideToClose: true,
                                        multiple: true,
                                        controller: ['$scope', 'tag', 'zones', function($scope, tag, zones) {


                                            let zonesIds = [];

                                            $scope.insertManagedZones = {
                                                resultClass: '',
                                                selectedZones: [],
                                                allZones: []
                                            };

                                            if (dataService.location.is_inside === 0) {
                                                newSocketService.getData('get_outdoor_zones', { location: dataService.location.name }, (response) => {

                                                    $scope.insertManagedZones.allZones = response.result.filter(z => !zones.some(zs => z.id === zs.zone_id));
                                                });
                                            } else {
                                                newSocketService.getData('get_floor_zones', {
                                                    floor: dataService.defaultFloorName,
                                                    location: dataService.location.name,
                                                    user: dataService.user.username
                                                }, (response) => {

                                                    $scope.insertManagedZones.allZones = response.result.filter(z => !zones.some(zs => z.id === zs.zone_id));
                                                });
                                            }
                                            /**
                                             * Function that insert a new zone
                                             * @param form
                                             */
                                            $scope.addManagedZones = (form) => {
                                                form.$submitted = true;

                                                if (form.$valid) {

                                                    $scope.insertManagedZones.allZones.filter(z => $scope.insertManagedZones.selectedZones.some(sz => sz === z.name))
                                                        .forEach((zone) => {
                                                            zonesIds.push(zone.id);
                                                        });

                                                    newSocketService.getData('insert_managed_zones', {
                                                        tag_id: tag.id,
                                                        zones: zonesIds,
                                                    }, (response) => {
                                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                                        $mdDialog.hide();
                                                        $mdDialog.show(tagZonesDialog);
                                                    });
                                                } else {
                                                    $scope.insertManagedZones.resultClass = 'background-red';
                                                }
                                            };

                                            $scope.hide = () => {
                                                $mdDialog.hide();
                                            }
                                        }]
                                    });
                                };

                                /**
                                 * Function that deletes a tag zone
                                 * @param zone
                                 */
                                $scope.deleteManagedZone = (zone) => {
                                    let confirm = $mdDialog.confirm()
                                        .title(lang.deleteZone.toUpperCase())
                                        .textContent(lang.deleteZoneText)
                                        .targetEvent(event)
                                        .multiple(true)
                                        .ok(lang.deleteZone)
                                        .cancel(lang.cancel);

                                    $mdDialog.show(confirm).then(() => {
                                        newSocketService.getData('delete_managed_zone', {
                                            tag_id: tag.id,
                                            zone_id: zone.zone_id
                                        }, (response) => {

                                            if (response.result === 1) {
                                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result.length !== 0);
                                                $scope.zones = $scope.zones.filter(z => z.zone_id !== zone.zone_id);
                                                $scope.$apply();
                                            }
                                        });
                                    }, function() {
                                        console.log('CANCELLATO!!!!');
                                    });
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        };

                        $mdDialog.show(tagZonesDialog);
                    };

                    /**
                     * Function that handle the tag parameters
                     * @param tag
                     */
                    $scope.tagParameters = (tag) => {
                        newSocketService.getData('get_tag_parameters', { tag: tag.id }, (response) => {

                            let tagParameters = {
                                locals: { tag: tag, parameters: response.result },
                                templateUrl: componentsPath + 'manage-parameters.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                multiple: true,
                                controller: ['$scope', 'tag', 'parameters', function($scope, tag, parameters) {
                                    $scope.resultClass = '';
                                    $scope.tag = tag;
                                    $scope.tagParameters = parameters[0];
                                    $scope.sendedValues = {
                                        tag_id: tag.id,
                                        adv_rate: $scope.tagParameters.adv_rate,
                                        power_level: $scope.tagParameters.power_level,
                                        disable_timing: $scope.tagParameters.disable_timing,
                                        alarm_timing: $scope.tagParameters.alarm_timing,
                                        no_mov_timing: $scope.tagParameters.no_mov_timing,
                                        md_mode: $scope.tagParameters.md_mode,
                                        ka: $scope.tagParameters.ka,
                                        scanning_rate: $scope.tagParameters.scanning_rate,
                                        lnd_prt_timing: $scope.tagParameters.lnd_prt_timing,
                                        scanning_pkt: $scope.tagParameters.scanning_pkt,
                                        freefall_thd: $scope.tagParameters.freefall_thd,
                                        sim_is_here: $scope.tagParameters.sim_is_here,
                                        wifi_is_here: $scope.tagParameters.wifi_is_here,
                                        advertise_is_here: $scope.tagParameters.advertise_is_here,
                                        mac_filter: $scope.tagParameters.mac_filter,
                                        apn_name: $scope.tagParameters.apn_name,
                                        apn_code: $scope.tagParameters.apn_code,
                                        rest_name: $scope.tagParameters.rest_name,
                                        server_ip: $scope.tagParameters.server_ip,
                                        ssid_wifi: $scope.tagParameters.ssid_wifi,
                                        pwd_wifi: $scope.tagParameters.pwd_wifi,
                                        ip_gateway_wifi: $scope.tagParameters.ip_gateway_wifi,
                                        ip_wetag_wifi: $scope.tagParameters.ip_wetag_wifi,
                                        geofence_thd: $scope.tagParameters.geofence_thd,
                                        mac_uwb: $scope.tagParameters.mac_uwb,
                                        udp_port_uwb: $scope.tagParameters.udp_port_uwb,
                                        periodic_sound: $scope.tagParameters.periodic_sound,
                                        tacitation_mode: $scope.tagParameters.tacitation_mode,
                                        standby_mode: $scope.tagParameters.standby_mode,
                                        lnd_prt_angle: $scope.tagParameters.lnd_prt_angle,
                                        beacon_type: $scope.tagParameters.beacon_type
                                    };

                                    //TODO put the parameters in the language file
                                    $scope.selectValues = {
                                        adv_rate: [{ label: "1 s", value: 1 }, { label: "2 s", value: 2 }, {
                                            label: "3 s",
                                            value: 3
                                        }, { label: "4 s", value: 4 }, { label: "5 s", value: 5 }],
                                        power_level: [{ label: "0 dBm", value: 0 }, {
                                                label: "1 dBm",
                                                value: 1
                                            }, { label: "2 dBm", value: 2 }, { label: "3 dBm", value: 3 }, {
                                                label: "4 dBm",
                                                value: 4
                                            },
                                            { label: "5 dBm", value: 5 }, {
                                                label: "6 dBm",
                                                value: 6
                                            }, { label: "7 dBm", value: 7 }, { label: "8 dBm", value: 8 }
                                        ],
                                        disable_timing: [{ label: "1 min", value: 1 }, {
                                                label: "2 min",
                                                value: 2
                                            }, { label: "3 min", value: 3 }, { label: "4 min", value: 4 }, {
                                                label: "5 min",
                                                value: 5
                                            },
                                            { label: "6 min", value: 6 }, {
                                                label: "7 min",
                                                value: 7
                                            }, { label: "8 min", value: 8 }, { label: "9 min", value: 9 }, {
                                                label: "10 min",
                                                value: 10
                                            }
                                        ],
                                        alarm_timing: [{ label: "10 s", value: 10 }, {
                                            label: "15 s",
                                            value: 15
                                        }, { label: "20 s", value: 20 }, { label: "25 s", value: 25 }, {
                                            label: "30 s",
                                            value: 30
                                        }],
                                        no_mov_timing: [{ label: "1 min", value: 1 }, {
                                                label: "2 min",
                                                value: 2
                                            }, { label: "3 min", value: 3 }, { label: "4 min", value: 4 }, {
                                                label: "5 min",
                                                value: 5
                                            },
                                            { label: "6 min", value: 6 }, {
                                                label: "7 min",
                                                value: 7
                                            }, { label: "8 min", value: 8 }, { label: "9 min", value: 9 }
                                        ],
                                        md_mode: [{ label: "LND/PRT", value: 0 }, {
                                                label: "MOV",
                                                value: 1
                                            }, { label: "LND/PRT/MOV", value: 2 }, {
                                                label: "LND/PRT L",
                                                value: 3
                                            }, { label: "LND/PRT/MOV L", value: 4 },
                                            { label: "FREEFALL", value: 5 }, {
                                                label: "LND/PRT/FREEFALL L",
                                                value: 6
                                            }, { label: "LND/PRT/MOV/FREEFALL L", value: 7 }
                                        ],
                                        ka: [{ label: "10 min", value: 1 }, {
                                            label: "15 min",
                                            value: 2
                                        }, { label: "30 min", value: 3 }, { label: "60 min", value: 4 }, {
                                            label: "90 min",
                                            value: 5
                                        }, { label: "120 min", value: 6 }],
                                        scanning_rate: [{ label: "1 s", value: 1 }, {
                                            label: "5 s",
                                            value: 2
                                        }, { label: "10 s", value: 3 }, { label: "20 s", value: 4 }, {
                                            label: "30 s",
                                            value: 5
                                        }, { label: "60 s", value: 6 }],
                                        lnd_prt_timing: [{ label: "10 s", value: 1 }, {
                                                label: "20 s",
                                                value: 2
                                            }, { label: "30 s", value: 3 }, { label: "40 s", value: 4 }, {
                                                label: "50 s",
                                                value: 5
                                            },
                                            { label: "60 s", value: 6 }, {
                                                label: "70 s",
                                                value: 7
                                            }, { label: "80 s", value: 8 }, { label: "90 s", value: 9 }, {
                                                label: "120 s",
                                                value: 10
                                            }
                                        ],
                                        scanning_pkt: [{ label: "5 pkt", value: 1 }, {
                                            label: "10 pkt",
                                            value: 2
                                        }, { label: "20 pkt", value: 3 }, { label: "40 pkt", value: 4 }, {
                                            label: "60 pkt",
                                            value: 5
                                        }, { label: "80 pkt", value: 6 }],
                                        freefall_thd: [{ label: "40 cm", value: 1 }, {
                                                label: "60 cm",
                                                value: 2
                                            }, { label: "80 cm", value: 3 }, { label: "100 cm", value: 4 }, {
                                                label: "120 cm",
                                                value: 5
                                            }, { label: "140 cm", value: 6 },
                                            { label: "160 cm", value: 7 }, {
                                                label: "180 cm",
                                                value: 8
                                            }, { label: "200 cm", value: 9 }
                                        ],
                                        sim_is_here: [{ label: "NO", value: 0 }, { label: "SI", value: 1 }],
                                        wifi_is_here: [{ label: "NO", value: 0 }, { label: "SI", value: 1 }],
                                        advertise_is_here: [{ label: "NO", value: 0 }, { label: "SI", value: 1 }],
                                        mac_filter: '',
                                        apn_name: [{ label: "VODAFONE", value: 'ep.inetd.gdsp' }, {
                                            label: "TIM",
                                            value: 'ibox.tim.it'
                                        }, { label: "FASTWEB", value: 'apn.fastweb.it' }, {
                                            label: "EMNIFY",
                                            value: 'em'
                                        }, { label: "JERSEY", value: 'JTFIXEDPUBLIC' }, {
                                            label: 'JERSEY NEW',
                                            value: 'JTM2M'
                                        }],
                                        apn_code: [{ label: "VODAFONE", value: '22210' }, {
                                            label: "TIM",
                                            value: '00001'
                                        }, { label: "FASTWEB", value: '00002' }, {
                                            label: "EMNIFY",
                                            value: '00003'
                                        }, { label: "JERSEY", value: '00004' }, { label: 'JERSEY NEW', value: '00005' }],
                                        rest_name: '',
                                        server_ip: '',
                                        ssid_wifi: '',
                                        pwd_wifi: '',
                                        ip_gateway_wifi: '',
                                        ip_wetag_wifi: '',
                                        geofence_thd: [{ label: "0 m", value: 1 }, {
                                                label: "1 m",
                                                value: 2
                                            }, { label: "2 m", value: 3 }, { label: "3 m", value: 4 }, {
                                                label: "4 m",
                                                value: 5
                                            }, { label: "5 m", value: 6 },
                                            { label: "6 m", value: 7 }, {
                                                label: "7 m",
                                                value: 8
                                            }, { label: "8 m", value: 9 }, { label: "9 m", value: 10 }, {
                                                label: "10 m",
                                                value: 11
                                            }, { label: "11 m", value: 12 }, { label: "12 m", value: 13 },
                                            { label: "13 m", value: 14 }, {
                                                label: "14 m",
                                                value: 15
                                            }, { label: "15 m", value: 16 }, { label: "17 m", value: 18 }, {
                                                label: "18 m",
                                                value: 19
                                            }, { label: "19 m", value: 20 }
                                        ],
                                        mac_uwb: '',
                                        udp_port_uwb: '',
                                        periodic_sound: [{ label: 'SI', value: 1 }, { label: 'NO', value: 0 }],
                                        tacitation_mode: [{
                                            label: 'PRESSIONE PROLUNGATA',
                                            value: 0
                                        }, { label: 'TRIPLO CLICK', value: 1 }],
                                        standby_mode: [{ label: 'DISBILITATO', value: 0 }, {
                                            label: 'ABILITATO',
                                            value: 1
                                        }],
                                        lnd_prt_angle: [{ label: "15 °", value: 1 }, {
                                                label: "20 °",
                                                value: 2
                                            }, { label: "30 °", value: 3 }, { label: "35 °", value: 4 }, {
                                                label: "40 °",
                                                value: 5
                                            }, { label: "45 °", value: 6 },
                                            { label: "55 °", value: 7 }, {
                                                label: "60 °",
                                                value: 8
                                            }, { label: "70 °", value: 9 }, { label: "75 °", value: 10 }
                                        ],
                                        beacon_type: [{ label: "EMBC-02", value: 0 }, { label: "EMBC-22", value: 1 }]
                                    };

                                    /**
                                     * Function that update the tag parameters
                                     * @param form
                                     */
                                    $scope.insertConfigurations = (form) => {
                                        form.$submitted = true;

                                        console.log($scope.sendedValues);
                                        if (form.$valid) {
                                            newSocketService.getData('update_parameters', { data: $scope.sendedValues }, (response) => {
                                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result === 1);

                                                if (response.result === 1) {
                                                    $scope.resultClass = 'background-green';
                                                    $scope.$apply();
                                                    $timeout(function() {
                                                        $mdDialog.hide();
                                                    }, 1500);
                                                } else {
                                                    $scope.resultClass = 'background-red';
                                                }
                                            })
                                        } else {
                                            $scope.resultClass = 'background-red';
                                        }
                                    };

                                    $scope.hide = () => {
                                        $mdDialog.hide();
                                    }
                                }]
                            };

                            $mdDialog.show(tagParameters);
                        })
                    };

                    /**
                     * Function that manage the call me button
                     * @param tag
                     */
                    $scope.callMe = (tag) => {
                        if (!$scope.tagsCallMe[tag.id]['on']) {
                            newSocketService.getData('set_call_me', { tag: tag.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);

                                if (response.result > 0) {

                                    $scope.tagsCallMe[tag.id]['on'] = true;
                                    $scope.tagsCallMe[tag.id]['background'] = 'color-darkgreen';
                                    $scope.tagsCallMe[tag.id]['value'] = lang.stopCallMe;
                                }
                            });
                        } else {
                            newSocketService.getData('stop_call_me', { tag: tag.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);

                                if (response.result > 0) {
                                    $scope.tagsCallMe[tag.id]['on'] = false;
                                    $scope.tagsCallMe[tag.id]['background'] = 'color-darkred';
                                    $scope.tagsCallMe[tag.id]['value'] = lang.callMe;
                                }
                            });
                        }
                    };

                    /**
                     * Function that show hide the columns of the table
                     * @param item
                     * @param list
                     */
                    $scope.toggle = function(item, list) {
                        console.log(list);
                        let idx = list.indexOf(item);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        } else {
                            list.push(item);
                        }
                    };

                    /**
                     * Function that sets the label of the select column field
                     * @returns {string}
                     */
                    $scope.getName = () => {
                        return lang.columns
                    };

                    /**
                     * Function that control if a column must be displayed
                     * @param item
                     * @param list
                     * @returns {boolean}
                     */
                    $scope.exists = function(item, list) {
                        return list.indexOf(item) > -1;
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    switch (position) {
                        case 'home':
                            if (dataService.homeTimer === undefined) {
                                NgMap.getMap('main-map').then((map) => {
                                    $rootScope.$emit('constantUpdateNotifications', map)
                                });
                            }
                            break;
                        case 'canvas':
                            if (dataService.canvasInterval === undefined) {
                                $rootScope.$emit('constantUpdateCanvas', {})
                            }
                            break;
                        case 'outdoor':
                            if (dataService.updateMapTimer === undefined) {
                                NgMap.getMap('outdoor-map').then((map) => {
                                    $rootScope.$emit('constantUpdateMapTags', map)
                                });
                            }
                            break;
                    }
                }
            };

            $mdDialog.show(registryDialog);
        };

        /**
         * Function that show the tag categories table
         */
        $scope.tagCategories = () => {
            $mdDialog.show({
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager },
                templateUrl: componentsPath + 'tag-category-table.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', function($scope, admin, userManager) {

                    $scope.isAdmin = admin;
                    $scope.tagCategories = {};
                    $scope.type_tags = dataService.allTags;

                    $scope.sendTags = () => {
                        let category_tags = [];

                        $scope.tagCategories.forEach(function(category) {
                            let cat = {};
                            cat.category = category.id;
                            cat.tags = category.tags;
                            category_tags.push(cat)
                        });

                        newSocketService.getData('save_category_tags', { data: category_tags }, (response) => {
                            dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result.length === 0);
                        });

                    };

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Function that gives the categories that the tag has
                     * @param category
                     * @param tag
                     * @returns {boolean}
                     */
                    $scope.isTagInCategory = (category, tag) => {
                        if (category.tags !== undefined) {
                            return category.tags.some(c => parseInt(c) === tag)
                        }
                    };

                    /**
                     * Function that update the categories table
                     */
                    let updateCategoriesTable = () => {
                        newSocketService.getData('get_tag_categories', {}, (response) => {
                            newSocketService.getData('get_categorie_tags', {}, (cat_tag) => {
                                $scope.tagCategories = response.result;

                                $scope.tagCategories.forEach(category => {
                                    Object.entries(cat_tag.result).forEach(tag => {
                                        if (tag[0] === "" + category.id) {
                                            category.tags = tag[1]['0']
                                        }
                                    })
                                });
                            })
                        });
                    };

                    updateCategoriesTable();

                    /**
                     * Function that add a new category
                     */
                    $scope.addTagCategory = () => {
                        $mdDialog.show({
                            templateUrl: componentsPath + 'insert-tag-category-row.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', function($scope) {

                                $scope.insertTagCategory = {
                                    name: '',
                                    resultClass: '',
                                    showSuccess: false,
                                    showError: false,
                                    message: ''
                                };

                                let alarm_image = null;
                                let no_alarm_image = null;

                                $scope.submitTagCategory = (form) => {
                                    form.$submitted = true;
                                    $scope.insertTagCategory.showError = false;
                                    $scope.insertTagCategory.showSuccess = false;

                                    if (form.$valid) {

                                        let alarm_file = null;
                                        let alarm_fileName = '';
                                        let no_alarm_file = null;
                                        let no_alarm_fileName = '';

                                        if (alarm_image != null && alarm_image.files.length !== 0) {
                                            alarm_file = alarm_image.files[0];
                                            alarm_fileName = alarm_file.name;
                                        }

                                        if (no_alarm_image != null && no_alarm_image.files.length !== 0) {
                                            no_alarm_file = no_alarm_image.files[0];
                                            no_alarm_fileName = no_alarm_file.name;
                                        }

                                        if (alarm_file != null && no_alarm_file != null) {
                                            convertImageToBase64(alarm_file)
                                                .then((images) => {
                                                    if (images !== null) {
                                                        newSocketService.getData('save_tag_category_alarm_image', {
                                                            imageName: alarm_fileName,
                                                            image: images
                                                        }, (savedImage) => {

                                                            convertImageToBase64(no_alarm_file)
                                                                .then((no_alarm_images) => {
                                                                    if (no_alarm_images !== null) {
                                                                        newSocketService.getData('save_tag_category_alarm_image', {
                                                                            imageName: no_alarm_fileName,
                                                                            image: no_alarm_images
                                                                        }, (no_alarm_savedImage) => {

                                                                            if (savedImage.result === false || no_alarm_savedImage === false) {
                                                                                $scope.insertTag.resultClass = 'background-red';
                                                                                $scope.insertTagCategory.showError = true;
                                                                                $scope.insertTagCategory.message = lang.cannotConvertImage
                                                                            } else {
                                                                                if (alarm_fileName !== '' && no_alarm_fileName !== '') {
                                                                                    newSocketService.getData('insert_tag_category', {
                                                                                        name: $scope.insertTagCategory.name,
                                                                                        alarm_name: alarm_fileName,
                                                                                        no_alarm_name: no_alarm_fileName
                                                                                    }, (response) => {
                                                                                        if (!response.session_state)
                                                                                            window.location.reload();

                                                                                        if (response.result !== 0) {
                                                                                            $scope.insertTagCategory.resultClass = 'background-green';
                                                                                            updateCategoriesTable();
                                                                                            $timeout(function() {
                                                                                                $mdDialog.hide();
                                                                                            }, 1000);
                                                                                        } else {
                                                                                            $scope.insertTag.resultClass = 'background-red';
                                                                                            $scope.insertTagCategory.showError = true;
                                                                                            $scope.insertTagCategory.message = lang.cannotSaveImage
                                                                                        }
                                                                                    });
                                                                                } else {
                                                                                    $scope.insertTag.resultClass = 'background-red';
                                                                                    $scope.insertTagCategory.showError = true;
                                                                                    $scope.insertTagCategory.message = lang.cannotConvertImage
                                                                                }
                                                                            }
                                                                        });
                                                                    } else {
                                                                        $scope.insertTagCategory.resultClass = 'background-red';
                                                                        $scope.insertTagCategory.showError = true;
                                                                        $scope.insertTagCategory.message = lang.cannotConvertImage
                                                                    }
                                                                })
                                                        });
                                                    } else {
                                                        $scope.insertTagCategory.resultClass = 'background-red';
                                                        $scope.insertTagCategory.showError = true;
                                                        $scope.insertTagCategory.message = lang.cannotConvertImage
                                                    }
                                                })
                                        } else {
                                            $scope.insertTagCategory.resultClass = 'background-red';
                                            $scope.insertTagCategory.showError = true;
                                            $scope.insertTagCategory.message = lang.tagCategorySelectImage
                                        }
                                    } else {
                                        $scope.insertTagCategory.resultClass = 'background-red';
                                    }
                                };

                                $scope.uploadTagCategoryAlarmImage = () => {
                                    alarm_image = document.getElementById('alarm-image');
                                    alarm_image.click();
                                };

                                $scope.uploadTagCategoryNoAlarmImage = () => {
                                    no_alarm_image = document.getElementById('no-alarm-image');
                                    no_alarm_image.click();
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        });
                    };

                    /**
                     * Function that edit a cell of the table
                     * @param event
                     * @param category
                     * @param categoryName
                     */
                    $scope.editCell = (event, category, categoryName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: category[categoryName],
                                save: function(input) {
                                    input.$invalid = true;
                                    category[categoryName] = input.$modelValue;
                                    newSocketService.getData('change_tag_category_field', {
                                        category_id: category.id,
                                        category_field: categoryName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Function that delete a category
                     * @param $event
                     * @param category
                     */
                    $scope.deleteTagCategory = ($event, category) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteCategory.toUpperCase())
                            .textContent(lang.deleteCategoryText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteCategory)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            console.log('the category is: ', category);
                            newSocketService.getData('delete_tag_category', { category_id: category.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);

                                if (response.result === 1) {
                                    $scope.tagCategories = $scope.tagCategories.filter(c => c.id !== category.id);
                                    $scope.$apply();
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        /**
         * Function that show the safety box table
         */
        $scope.safetyBox = () => {
            $mdDialog.show({
                locals: { admin: $scope.isAdmin, userManager: $scope.isUserManager },
                templateUrl: componentsPath + 'safety-box-table.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', 'userManager', function($scope, admin, userManager) {

                    $scope.isAdmin = admin;
                    $scope.safety_boxes = {};
                    $scope.type_tags = dataService.allTags;

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    let updateSafetyBoxTable = () => {
                        newSocketService.getData('get_safety_box', {}, (response) => {

                            $scope.safety_boxes = response.result;
                        });
                    };

                    updateSafetyBoxTable();

                    /**
                     * Function that adds a new safety box
                     */
                    $scope.addSafetyBox = () => {
                        $mdDialog.show({
                            templateUrl: componentsPath + 'insert-safety-box-row.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            multiple: true,
                            controller: ['$scope', function($scope) {

                                $scope.insertSafetyBox = {
                                    name: '',
                                    imei: '',
                                    resultClass: '',
                                    showSuccess: false,
                                    showError: false,
                                    message: ''
                                };

                                /**
                                 * Function that update the satety box database table
                                 * @param form
                                 */
                                $scope.submitSafetyBox = (form) => {
                                    form.$submitted = true;

                                    if (form.$valid) {
                                        newSocketService.getData('insert_safety_box', {
                                            name: $scope.insertSafetyBox.name,
                                            imei: $scope.insertSafetyBox.imei
                                        }, (response) => {
                                            dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 'ERROR_ON_INSERTING_SAFETY_BOX');

                                            if (response.result !== 'ERROR_ON_INSERTING_SAFETY_BOX') {
                                                $scope.insertSafetyBox.resultClass = 'background-green';
                                                $scope.$apply();
                                                $timeout(function() {
                                                    $mdDialog.hide();
                                                    updateSafetyBoxTable();
                                                }, 1500);
                                            }
                                        });
                                    } else {
                                        $scope.insertSafetyBox.resultClass = 'background-red';
                                    }
                                };

                                $scope.hide = () => {
                                    $mdDialog.hide();
                                }
                            }]
                        });
                    };

                    //TODO create a function edit cell and call it from all the tables
                    /**
                     * Function that update a cell in the table
                     * @param event
                     * @param safety_box
                     * @param safety_box_name
                     */
                    $scope.editCell = (event, safety_box, safety_box_name) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: safety_box[safety_box_name],
                                save: function(input) {
                                    input.$invalid = true;
                                    safety_box[safety_box_name] = input.$modelValue;
                                    newSocketService.getData('change_safety_box_field', {
                                        safety_box_id: safety_box.id,
                                        safety_box_field: safety_box_name,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Function that delete a safety box
                     * @param $event
                     * @param safety_box
                     */
                    $scope.deleteSafetyBox = ($event, safety_box) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteSafetyBox.toUpperCase())
                            .textContent(lang.deleteSafetyBoxText)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteSafetyBox)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_safety_box', { safety_box_id: safety_box.id }, (response) => {

                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);
                                if (response.result === 1) {
                                    updateSafetyBoxTable();
                                }
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        /**
         * Funcion that open the zone table
         */
        $scope.zone = () => {
            $interval.cancel(dataService.canvasInterval);
            dataService.canvasInterval = undefined;

            let floor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName)[0];

            let addRowDialog = {
                templateUrl: componentsPath + 'insert-zones-row.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {

                    $scope.insertZone = {
                        zoneName: '',
                        x_left: '',
                        x_right: '',
                        y_up: '',
                        y_down: '',
                        color: '',
                        resultClass: '',
                    };

                    /**
                     * Function that insert a new zone
                     * @param form
                     */
                    $scope.insertZone = function(form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            let data = {
                                name: $scope.insertZone.zoneName,
                                x_left: $scope.insertZone.x_left,
                                x_right: $scope.insertZone.x_right,
                                y_up: $scope.insertZone.y_up,
                                y_down: $scope.insertZone.y_down,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#000000',
                                floor: floor.id
                            };

                            let stringified = JSON.stringify(data);

                            newSocketService.getData('insert_floor_zone', { data: stringified }, (response) => {

                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);

                                if (response.result !== 0) {
                                    $scope.insertZone.resultClass = 'background-green';
                                    $timeout(function() {
                                        $mdDialog.hide(addRowDialog);
                                        $rootScope.$emit('updateZoneTable', {});
                                    }, 1000);
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that  handle the zone table
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, string, function(*=, *=): void], multiple: boolean, onRemoving: onRemoving, targetEvent: Event, locals: {admin: *}, templateUrl: string}}
             */
            let zoneDialog = {
                locals: { admin: $scope.isAdmin },
                templateUrl: componentsPath + 'zone-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', function($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isOutdoor = false;
                    $scope.tableEmptyZone = false;
                    $scope.isUserManager = dataService.isUserManager;
                    $scope.items = ['name', 'x_left', 'x_right', 'y_up', 'y_down', 'color', 'priority', 'header_order', 'header_left_side'];
                    $scope.columns = [];
                    $scope.zonesTable = [];
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Function that update the color of the zone in the database
                     * @param zoneId
                     * @param zoneColor
                     */
                    $scope.changeColor = (zoneId, zoneColor) => {
                        newSocketService.getData('update_zone_color', {
                            zone_id: zoneId,
                            zone_color: zoneColor,
                        }, (response) => {
                            dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                        });
                    };

                    /**
                     * Function that retreive the floor zones
                     */
                    let updateZoneTable = () => {
                        newSocketService.getData('get_floor_zones', {
                            floor: floor.name,
                            location: dataService.location.name,
                            user: dataService.user.username
                        }, (response) => {

                            $scope.zonesTable = response.result;
                            $scope.tableEmptyZone = response.result.length === 0;
                            $scope.$apply();
                        });
                    };

                    updateZoneTable();

                    $rootScope.$on('updateZoneTable', function() {
                        updateZoneTable();
                    });

                    /**
                     * Function that edit a cell in the table
                     * @param event
                     * @param zone
                     * @param zoneName
                     */
                    $scope.editCell = (event, zone, zoneName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: zone[zoneName],
                                save: function(input) {
                                    input.$invalid = true;
                                    zone[zoneName] = input.$modelValue;

                                    newSocketService.getData('change_zone_field', {
                                        zone_id: zone.id,
                                        zone_field: zoneName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Function that deetes a row from the table
                     * @param zone
                     */
                    $scope.deleteRow = (zone) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteZone)
                            .textContent(lang.okDeleteZone)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteZone)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_floor_zone', { zone_id: zone.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);

                                $scope.zonesTable = $scope.zonesTable.filter(z => z.id !== zone.id);
                                $scope.$apply();
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    /**
                     * Function that show hide the columns of the table
                     * @param item
                     * @param list
                     */
                    $scope.toggle = function(item, list) {
                        console.log(list);
                        let idx = list.indexOf(item);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        } else {
                            list.push(item);
                        }
                    };

                    /**
                     * Function that sets the label of the select column field
                     * @returns {string}
                     */
                    $scope.getName = () => {
                        return lang.columns
                    };

                    /**
                     * Function that control if a column must be displayed
                     * @param item
                     * @param list
                     * @returns {boolean}
                     */
                    $scope.exists = function(item, list) {
                        return list.indexOf(item) > -1;
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.canvasInterval === undefined) {
                        $rootScope.$emit('constantUpdateCanvas', {})
                    }
                }
            };

            $mdDialog.show(zoneDialog);
        };

        /**
         * Function that handles the outdoor zones
         */
        $scope.zoneOutdoor = () => {
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);
            let zoneModified = false;

            let addRectRowDialog = {
                templateUrl: componentsPath + 'insert-zones-row.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    $scope.insertZone = {
                        zoneName: '',
                        x_left: '',
                        x_right: '',
                        y_up: '',
                        y_down: '',
                        color: '',
                        resultClass: '',
                    };

                    /**
                     * Function that insert a new zone
                     * @param form
                     */
                    $scope.insertZone = function(form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            let data = {
                                name: $scope.insertZone.zoneName,
                                x_left: $scope.insertZone.x_left,
                                x_right: $scope.insertZone.x_right,
                                y_up: $scope.insertZone.y_up,
                                y_down: $scope.insertZone.y_down,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#FF0000',
                                location: dataService.location.name
                            };

                            let stringified = JSON.stringify(data);

                            newSocketService.getData('insert_outdoor_rect_zone', { data: stringified }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);

                                if (response.result !== 0) {
                                    zoneModified = true;
                                    NgMap.getMap('outdoor-map').then((map) => {
                                        dataService.outdoorZones.push({
                                            id: response.result,
                                            zone: new google.maps.Rectangle({
                                                strokeColor: $scope.insertZone.color,
                                                strokeOpacity: 0.8,
                                                strokeWeight: 2,
                                                fillColor: $scope.insertZone.color,
                                                fillOpacity: 0.35,
                                                map: map,
                                                bounds: {
                                                    north: parseFloat($scope.insertZone.x_leftt),
                                                    south: parseFloat($scope.insertZone.x_right),
                                                    east: parseFloat($scope.insertZone.y_up),
                                                    west: parseFloat($scope.insertZone.y_down)
                                                }
                                            })
                                        });
                                        // $rootScope.$emit('constantUpdateMapTags', map, zoneColorModified);
                                    });

                                    //TODO add toast
                                    $scope.insertZone.resultClass = 'background-green';
                                    $timeout(function() {
                                        $mdDialog.hide(addRectRowDialog);
                                        $rootScope.$emit('updateZoneOutdoorTable', {});
                                    }, 1000);
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that handle the insertion of the round zone
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, function(*=): void], multiple: boolean, templateUrl: string}}
             */
            let addRoundRowDialog = {
                templateUrl: componentsPath + 'insert-outdoor-zones-row.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    $scope.insertZone = {
                        zoneName: '',
                        gpsNorth: '',
                        gpsEast: '',
                        radius: '',
                        color: '',
                        resultClass: '',
                    };

                    //insert a zone
                    $scope.insertZone = function(form) {
                        form.$submitted = true;

                        if (form.$valid) {
                            let data = {
                                name: $scope.insertZone.zoneName,
                                x: $scope.insertZone.gpsNorth,
                                y: $scope.insertZone.gpsEast,
                                radius: $scope.insertZone.radius,
                                color: ($scope.insertZone.color !== undefined) ? $scope.insertZone.color : '#FF0000',
                                location: dataService.location.name
                            };

                            let stringified = JSON.stringify(data);

                            newSocketService.getData('insert_outdoor_round_zone', { data: stringified }, (response) => {

                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                if (response.result !== 0) {
                                    NgMap.getMap('outdoor-map').then((map) => {
                                        // $rootScope.$emit('constantUpdateMapTags', map, zoneColorModified);
                                        zoneModified = true;
                                        dataService.outdoorZones.push({
                                            id: response.result,
                                            zone: new google.maps.Circle({
                                                strokeColor: $scope.insertZone.color,
                                                strokeOpacity: 0.8,
                                                strokeWeight: 2,
                                                fillColor: $scope.insertZone.color,
                                                fillOpacity: 0.35,
                                                map: map,
                                                center: {
                                                    lat: parseFloat($scope.insertZone.gpsNorth),
                                                    lng: parseFloat($scope.insertZone.gpsEast)
                                                },
                                                radius: $scope.insertZone.radius / 111000
                                            })
                                        });
                                    });

                                    //TODO add toast
                                    $scope.insertZone.resultClass = 'background-green';
                                    $timeout(function() {
                                        $mdDialog.hide(addRoundRowDialog);
                                        $rootScope.$emit('updateZoneOutdoorTable', {});
                                    }, 1000);
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.insertZone.resultClass = 'background-red';
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that handle the outdoor zones
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, string, function(*=, *=): void], multiple: boolean, onRemoving: onRemoving, targetEvent: Event, locals: {admin: *}, templateUrl: string}}
             */
            let zoneDialog = {
                locals: { admin: $scope.isAdmin },
                templateUrl: componentsPath + 'zone-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', function($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isOutdoor = true;
                    $scope.tableEmptyZone = false;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.zonesTable = [];
                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Function that change the outddor location color
                     * @param zoneId
                     * @param zoneColor
                     */
                    $scope.changeColor = (zoneId, zoneColor) => {
                        newSocketService.getData('update_zone_color', {
                            zone_id: zoneId,
                            zone_color: zoneColor,
                        }, (response) => {
                            dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);

                            dataService.outdoorZones.forEach(zone => {
                                if (zone.id === zoneId) {
                                    zone.zone.setOptions({ fillColor: zoneColor, strokeColor: zoneColor });
                                }
                            });
                        });
                    };

                    /**
                     * Function that update the outdoor zones table
                     */
                    let updateZoneOutdoorTable = () => {
                        newSocketService.getData('get_outdoor_zones', { location: dataService.location.name }, (response) => {

                            $scope.zonesTable = response.result;
                            $scope.$apply();
                        })
                    };

                    updateZoneOutdoorTable();

                    $rootScope.$on('updateZoneOutdoorTable', function() {
                        updateZoneOutdoorTable();
                    });

                    /**Function that edit a table cell
                     * @param event
                     * @param zone
                     * @param zoneName
                     */
                    $scope.editCell = (event, zone, zoneName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: zone[zoneName],
                                save: function(input) {
                                    input.$invalid = true;
                                    zone[zoneName] = input.$modelValue;
                                    newSocketService.getData('change_zone_field', {
                                        zone_id: zone.id,
                                        zone_field: zoneName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                        zoneModified = true;
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    /**
                     * Function that deletes a zone
                     * @param zone
                     */
                    $scope.deleteRow = (zone) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteZone)
                            .textContent(lang.okDeleteZone)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteZone)
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(() => {
                            newSocketService.getData('delete_floor_zone', { zone_id: zone.id }, (response) => {
                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);

                                $scope.zonesTable = $scope.zonesTable.filter(z => z.id !== zone.id);
                                let deletedZone = dataService.outdoorZones.filter(z => z.id === zone.id)[0];
                                deletedZone.zone.setMap(null);
                                dataService.outdoorZones = dataService.outdoorZones.filter(z => z.id !== zone.id);
                                $scope.$apply();
                            });
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //inserting tag
                    $scope.addNewRectRow = () => {
                        $mdDialog.show(addRectRowDialog);
                    };

                    $scope.addNewRoundRow = () => {
                        $mdDialog.show(addRoundRowDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.updateMapTimer === undefined && zoneModified) {
                        window.location.reload();
                    }
                }
            };

            $mdDialog.show(zoneDialog);
        };

        /**
         * Function that show the anchors table
         */
        $scope.showAnchorsTable = function() {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            let floor = dataService.userFloors.filter(f => f.name === dataService.defaultFloorName)[0];

            let addRowDialog = {
                templateUrl: componentsPath + 'insert-anchor-row.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {

                    $scope.insertAnchor = {
                        name: '',
                        mac: '',
                        selectedType: '',
                        ip: '',
                        rssi: '',
                        proximity: '',
                        selectedNeighbors: [],
                        selectedPermitteds: [],
                    };

                    $scope.permitteds = dataService.allTags;
                    $scope.tableEmpty = false;
                    $scope.searchString = '';
                    $scope.anchorTypes = [];

                    newSocketService.getData('get_anchors_by_floor_and_location', {
                        floor: floor.name,
                        location: dataService.location.name
                    }, (response) => {

                        $scope.neighbors = response.result;
                    });

                    newSocketService.getData('get_anchor_types', {}, (response) => {

                        $scope.anchorTypes = response.result;
                    });

                    $scope.updateSearch = (event) => {
                        event.stopPropagation();
                    };

                    /**
                     * Function that inset anew anchor
                     * @param form
                     */
                    $scope.addAnchor = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let neighborsString = '';
                            let permittedIds = [];
                            $scope.neighbors.filter(a => $scope.insertAnchor.selectedNeighbors.some(sa => sa === a.name))
                                .forEach((anchor) => {
                                    neighborsString += anchor.mac + ',';
                                });

                            neighborsString = neighborsString.replace(/,\s*$/, "");

                            $scope.permitteds = $scope.permitteds.filter(t => $scope.insertAnchor.selectedPermitteds.some(st => st === t.name))
                                .forEach((t) => {
                                    permittedIds.push(t.id);
                                });

                            newSocketService.getData('insert_anchor', {
                                name: $scope.insertAnchor.name,
                                mac: $scope.insertAnchor.mac,
                                type: $scope.insertAnchor.selectedType,
                                ip: $scope.insertAnchor.ip,
                                rssi: $scope.insertAnchor.rssi,
                                proximity: $scope.insertAnchor.proximity,
                                permitteds: permittedIds,
                                neighbors: neighborsString,
                                floor: floor.id
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result.length === 0);

                                if (response.result.length === 0) {
                                    $scope.insertAnchor.resultClass = 'background-green';
                                    $timeout(function() {
                                        $mdDialog.hide();
                                        $rootScope.$emit('updateAnchorsTable', {});
                                    }, 1000);
                                    $scope.$apply();
                                }
                            });
                        } else {
                            $scope.insertAnchor.resultClass = 'background-red';
                        }
                    };

                    $scope.clearSearch = () => {
                        $scope.searchString = '';
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that handle the anchors table
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, string, function(*=, *=): void], multiple: boolean, onRemoving: onRemoving, targetEvent: Event, locals: {admin: *}, templateUrl: string}}
             */
            let anchorsDialog = {
                locals: { admin: $scope.isAdmin },
                templateUrl: componentsPath + 'anchors-table.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', 'admin', function($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;
                    $scope.anchorTable = {
                        permittedAssets: [],
                        selectedPermitteds: [],
                        tags: dataService.allTags
                    };
                    $scope.anchors = [];
                    $scope.permitteds = [];
                    $scope.anchorTypes = [];
                    $scope.selectedType = null;
                    $scope.items = ['name', 'x_pos', 'y_pos', 'z_pos', 'floor', 'radius', 'ip', 'battery', 'state', 'rssi', 'proximity', 'type', 'mac', 'permiteds'];
                    $scope.columns = [];

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Function that update the anchors table
                     */
                    let updateAnchorsTable = () => {
                        $scope.anchors = [];

                        // getting all the anchors
                        newSocketService.getData('get_anchors_by_floor_and_location', {
                            floor: (floor.name !== undefined) ? floor.name : '',
                            location: dataService.location.name
                        }, (response) => {

                            // setting the permiteds in an array
                            response.result.forEach(anchor => {
                                let anchorPermitteds = anchor.permitted_asset !== null ? anchor.permitted_asset.split(',') : [];
                                $scope.anchors.push({
                                    anchor: anchor,
                                    permitteds: anchorPermitteds[0] === "" ? [] : anchorPermitteds
                                });
                            });

                            console.log($scope.anchors);
                            $scope.$apply();
                        });

                        newSocketService.getData('get_all_tags_macs', {}, (response) => {

                            // getting for each tag all his permitteds
                            dataService.allTags.forEach(tag => {
                                response.result.forEach(mac => {
                                    if (mac.tag_name === tag.name) {
                                        $scope.anchorTable.permittedAssets.push({ tag: tag.name, mac: mac.mac });
                                    }
                                });
                            });
                        });
                    };

                    /**
                     * Fuction that control if the permitted assets are changed
                     * @param anchor
                     * @param permitteds
                     * @returns {boolean}
                     */
                    let isPermittedChanged = (anchor, permitteds) => {
                        let selectedAnchor = $scope.anchors.find(a => a.anchor.id === anchor);

                        if (selectedAnchor.anchor.permitted_asset.length === 0)
                            return true;

                        let anchorPermited = selectedAnchor.anchor.permitted_asset.split(',');

                        let permittedsArray = anchorPermited[0] === "" ? [] : anchorPermited;
                        return !angular.equals(permitteds, permittedsArray);
                    };

                    /**
                     * Function that update the permiteds
                     * @param anchor
                     * @param permitteds
                     */
                    $scope.updatePermitteds = (anchor, permitteds) => {

                        if (isPermittedChanged(anchor, permitteds)) {
                            let permittedsString = '';
                            permitteds.forEach(permitted => {
                                permittedsString += permitted + ',';
                            });

                            newSocketService.getData('update_anchor_permitteds', {
                                anchor_id: anchor,
                                permitteds: permittedsString
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                            });
                        }
                    };

                    updateAnchorsTable();

                    newSocketService.getData('get_anchor_types', {}, (anchor_types) => {
                        $scope.anchorTypes = anchor_types.result
                    });

                    /**
                     * Function that update the anchor types
                     * @param anchor
                     * @param selectedType
                     */
                    $scope.updateAnchorType = (anchor, selectedType) => {
                        if (anchor.anchor.anchor_type_id !== selectedType) {
                            newSocketService.getData('change_anchor_field', {
                                anchor_id: anchor.anchor.id,
                                anchor_field: 'type',
                                field_value: selectedType
                            }, (response) => {
                                dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                            });
                        }
                    };

                    $rootScope.$on('updateAnchorsTable', function() {
                        updateAnchorsTable();
                    });

                    /**
                     * Function that edit a cell of the table
                     * @param event
                     * @param anchor
                     * @param anchorName
                     */
                    $scope.editCell = (event, anchor, anchorName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: anchor[anchorName],
                                save: function(input) {
                                    input.$invalid = true;
                                    anchor[anchorName] = input.$modelValue;
                                    newSocketService.getData('change_anchor_field', {
                                        anchor_id: anchor.id,
                                        anchor_field: anchorName,
                                        field_value: input.$modelValue
                                    }, (response) => {
                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //inserting an anchor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    /**
                     * Function that deletes a row in the table
                     */
                    $scope.deleteRow = (anchor) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteAnchor.toUpperCase())
                            .textContent(lang.okDeleteAnchor)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteAnchor.toUpperCase())
                            .cancel(lang.cancel);

                        $mdDialog.show(confirm).then(function() {
                            newSocketService.getData('delete_anchor', { anchor_id: anchor.id }, (response) => {

                                dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);
                                if (response.result > 0)
                                    $rootScope.$emit('updateAnchorsTable', {});
                            })
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    /**
                     * Function that show hide the columns of the table
                     * @param item
                     * @param list
                     */
                    $scope.toggle = function(item, list) {
                        console.log(list);
                        let idx = list.indexOf(item);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        } else {
                            list.push(item);
                        }
                    };

                    /**
                     * Function that sets the label of the select column field
                     * @returns {string}
                     */
                    $scope.getName = () => {
                        return lang.columns
                    };

                    /**
                     * Function that control if a column must be displayed
                     * @param item
                     * @param list
                     * @returns {boolean}
                     */
                    $scope.exists = function(item, list) {
                        return list.indexOf(item) > -1;
                    };

                    $scope.hideAnchors = () => {
                        $mdDialog.hide();
                    };
                }],
                onRemoving: function() {
                    if (dataService.canvasInterval === undefined) {
                        $rootScope.$emit('constantUpdateCanvas', {})
                    }
                }
            };
            $mdDialog.show(anchorsDialog);
        };

        /**
         * Function that show the floor table
         */
        $scope.floorUpdate = () => {
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);

            let floorChanged = false;

            let addRowDialog = {
                templateUrl: componentsPath + 'insert-floor-row.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                multiple: true,
                controller: ['$scope', function($scope) {
                    let fileInput = null;
                    let currentLocation = null;

                    $scope.insertFloor = {
                        floorName: '',
                        mapWidth: '',
                        spacing: '',
                        showSuccess: false,
                        showError: false,
                        message: '',
                        resultClass: ''
                    };

                    /**
                     * Function that inset a new floor
                     * @param form
                     */
                    $scope.insertFloor = (form) => {
                        form.$submitted = true;

                        if (form.$valid) {
                            let file = null;
                            let fileName = null;

                            if (fileInput != null && fileInput.files.length !== 0) {
                                file = fileInput.files[0];
                                fileName = file.name;
                            }

                            newSocketService.getData('get_all_locations', {}, (response) => {

                                currentLocation = response.result.filter(l => l.name === dataService.location.name)[0];

                                if (file !== null) {
                                    newSocketService.getData('insert_floor', {
                                        name: $scope.insertFloor.floorName,
                                        map_image: (fileName === null) ? '' : fileName,
                                        map_width: $scope.insertFloor.mapWidth,
                                        spacing: $scope.insertFloor.spacing,
                                        location: currentLocation.id
                                    }, (insertedFloor) => {

                                        if (insertedFloor.result !== undefined && insertedFloor.result !== 0) {
                                            convertImageToBase64(file)
                                                .then((base64File) => {
                                                    newSocketService.getData('save_floor_image', {
                                                        imageName: fileName,
                                                        image: base64File
                                                    }, (savedImage) => {

                                                        //TODO add toast
                                                        if (savedImage.result === false) {
                                                            $scope.insertFloor.showSuccess = false;
                                                            $scope.insertFloor.showError = true;
                                                            $scope.insertFloor.message = lang.floorInsertedWithoutImage;
                                                            $scope.insertFloor.resultClass = 'background-orange';

                                                            $scope.$apply();

                                                            $timeout(function() {
                                                                $mdDialog.hide();
                                                                $rootScope.$emit('updateFloorTable', {});
                                                            }, 1000);
                                                        } else {
                                                            $scope.insertFloor.resultClass = 'background-green';
                                                            $scope.insertFloor.showSuccess = true;
                                                            $scope.insertFloor.showError = false;
                                                            $scope.insertFloor.message = lang.floorInserted;

                                                            $scope.$apply();

                                                            $timeout(function() {
                                                                $mdDialog.hide();
                                                                $rootScope.$emit('updateFloorTable', {});
                                                            }, 1000);
                                                        }
                                                    });
                                                });
                                        } else {
                                            $scope.insertFloor.showSuccess = false;
                                            $scope.insertFloor.showError = true;
                                            $scope.insertFloor.message = lang.impossibleInsertFloor;
                                            $scope.insertFloor.resultClass = 'background-red';
                                        }
                                    });
                                } else {
                                    $scope.insertFloor.showSuccess = false;
                                    $scope.insertFloor.showError = true;
                                    $scope.insertFloor.message = lang.selectFloorFile;
                                    $scope.insertFloor.resultClass = 'background-red';
                                }
                            });
                        } else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadFloorImage = () => {
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }]
            };

            /**
             * Object that handle the tag table
             * @type {{parent: Object, clickOutsideToClose: boolean, controller: [string, string, function(*=, *=): void], onRemoving: onRemoving, targetEvent: Event, locals: {admin: *}, templateUrl: string}}
             */
            let floorDialog = {
                locals: { admin: $scope.isAdmin },
                templateUrl: componentsPath + 'floor-settings.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', 'admin', function($scope, admin) {
                    $scope.selected = [];
                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.query = {
                        limitOptions: [500, 15, 10, 5],
                        order: 'name',
                        limit: dataService.switch.showTableSorting ? 500 : 5,
                        page: 1
                    };

                    /**
                     * Function that update the tag table
                     */
                    let updateFloorTable = () => {
                        newSocketService.getData('get_floors_by_location', { location: dataService.location.name }, (response) => {

                            $scope.floors = response.result;
                            $scope.$apply();
                        });
                    };

                    updateFloorTable();

                    $rootScope.$on('updateFloorTable', function() {
                        updateFloorTable();
                    });

                    /**
                     * Function that edit a table cell
                     * @param event
                     * @param floor
                     * @param floorName
                     */
                    $scope.editCell = (event, floor, floorName) => {

                        event.stopPropagation();

                        if (admin) {
                            let editCell = {
                                modelValue: floor[floorName],
                                save: function(input) {
                                    input.$invalid = true;
                                    floor[floorName] = input.$modelValue;
                                    newSocketService.getData('change_floor_field', {
                                        floor_id: floor.id,
                                        floor_field: floorName,
                                        field_value: input.$modelValue
                                    }, (response) => {

                                        dataService.showMessage($mdToast, lang.elementInserted, lang.elementNotInserted, response.result !== 0);
                                        if (response.result === 1) {
                                            if (floorName === 'map_width')
                                                floorChanged = true;
                                            updateFloorTable();
                                        }
                                    });
                                },
                                targetEvent: event,
                                title: lang.insertValue,
                                validators: {
                                    'md-maxlength': 500
                                }
                            };

                            $mdEditDialog.large(editCell);
                        }
                    };

                    //inserting a new floor
                    $scope.addNewRow = () => {
                        $mdDialog.show(addRowDialog);
                    };

                    /**
                     * Function that deletes a floor
                     * @param floor
                     */
                    $scope.deleteRow = (floor) => {
                        let confirm = $mdDialog.confirm()
                            .title(lang.deleteFloor.toUpperCase())
                            .textContent(lang.okDeleteFloor)
                            .targetEvent(event)
                            .multiple(true)
                            .ok(lang.deleteFloor.toUpperCase())
                            .cancel(lang.cancel.toUpperCase());

                        $mdDialog.show(confirm).then(function() {
                            if ($scope.floors.length > 1) {
                                newSocketService.getData('delete_floor', { floor_id: floor.id }, (response) => {

                                    dataService.showMessage($mdToast, lang.elementDeleted, lang.elementNotDeleted, response.result !== 0);
                                    if (response.result > 0) {
                                        $scope.floors = $scope.floors.filter(a => a.id !== floor.id);
                                        if (floor.name === 'Piano di default')
                                            dataService.defaultFloorCanceled = true;
                                        $scope.$apply();
                                    }
                                });
                            }
                        }, function() {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    $scope.uploadFloorImage = (id) => {

                        let fileInput = document.getElementById('floor-image-' + id);

                        $scope.floorId = id;
                        fileInput.click();
                    };

                    $scope.fileNameChanged = () => {
                        let fileInput = document.getElementById('floor-image-' + $scope.floorId);
                        let file = null;
                        let fileName = null;

                        if (fileInput != null && fileInput.files.length !== 0) {
                            file = fileInput.files[0];
                            fileName = file.name;
                        }

                        if (file != null) {
                            convertImageToBase64(file)
                                .then((result) => {
                                    newSocketService.getData('save_floor_image', {
                                        id: $scope.floorId,
                                        image: result,
                                        name: fileName
                                    }, (floorImage) => {});
                                })
                        }
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving: function() {
                    if (dataService.canvasInterval === undefined) {
                        if (dataService.defaultFloorCanceled) {
                            window.location.reload();
                        } else if (floorChanged) {
                            window.location.reload();
                        } else {
                            $rootScope.$emit('constantUpdateCanvas', {})
                        }
                    }
                }
            };

            $mdDialog.show(floorDialog);
        };

        /**
         * Function that shows the legend
         */
        $scope.showLegend = () => {
            $mdDialog.show({
                templateUrl: componentsPath + 'legend-dialog.html',
                parent: angular.element(document.body),
                targetEvent: event,
                controller: ['$scope', 'dataService', function($scope, dataService) {

                    $scope.hide = () => {
                        $mdDialog.hide();
                    };
                }],
            });
        };

        /**
         * Function that show the quick actions
         */
        $scope.quickActions = () => {
            $mdDialog.show({
                templateUrl: componentsPath + 'quick-actions-dialog.html',
                parent: angular.element(document.body),
                targetEvent: event,
                controller: ['$scope', '$interval', 'dataService', function($scope, $interval, dataService) {

                    $scope.isAdmin = dataService.isAdmin;
                    $scope.isUserManager = dataService.isUserManager;

                    $scope.switch = {
                        showGrid: dataService.switch.showGrid,
                        showAnchors: dataService.switch.showAnchors,
                        showCameras: dataService.switch.showCameras,
                        showZones: dataService.switch.showZones,
                        showOutrangeTags: dataService.switch.showOutrangeTags,
                        showOutdoorTags: dataService.switch.showOutdoorTags,
                        showTableSorting: dataService.switch.showTableSorting,
                        playAudio: dataService.switch.playAudio
                    };


                    $scope.updateUserSettings = () => {
                        dataService.updateUserSettings();
                        $mdDialog.hide();
                    };

                    $scope.$watchGroup(['switch.showGrid', "switch.showAnchors", 'switch.showCameras', 'switch.playAudio', 'switch.showOutrangeTags', 'switch.showOutdoorTags', 'switch.showTableSorting', 'switch.showZones'], function(newValues) {
                        dataService.switch.showGrid = (newValues[0]);
                        dataService.switch.showAnchors = (newValues[1]);
                        dataService.switch.showCameras = (newValues[2]);
                        dataService.switch.playAudio = (newValues[3]);
                        dataService.switch.showOutrangeTags = (newValues[4]);
                        dataService.switch.showOutdoorTags = (newValues[5]);
                        dataService.switch.showTableSorting = (newValues[6]);
                        dataService.switch.showZones = (newValues[7]);
                    })
                }]
            });
        };

        /**
         * Fucntion that handles the logout of the user
         */
        $scope.logout = () => {
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);
            dataService.canvasInterval = dataService.stopTimer(dataService.canvasInterval);
            dataService.updateMapTimer = dataService.stopTimer(dataService.updateMapTimer);

            newSocketService.getData('logout', { username: dataService.user.username }, (response) => {

                if (response.result === 'logged_out') {
                    document.cookie = "username_smart = ; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                    document.cookie = "password_smart = ; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                    $state.go('login');
                }
            });
        };

        /**
         * Fucntion that handles the search of the locations
         */
        $scope.$watch('selectedLocation', function(newValue) {
            if (newValue.latitude !== undefined && newValue.longitude !== undefined) {
                let latlng = new google.maps.LatLng(newValue.latitude, newValue.longitude);
                if (dataService.homeMap !== null) {
                    dataService.homeMap.setCenter(latlng);
                    dataService.homeMap.setZoom(15);
                }
            }
        });

        /**
         * Function that handes the search tag functionality
         */
        $scope.$watch('selectedTag', function(newValue) {
            let newStringValue = "" + newValue;
            if (newStringValue !== '') {

                let newTag = dataService.allTags.find(t => t.name === newValue);
                if (newTag !== undefined) {
                    if (newTag.radio_switched_off) {
                        dataService.showToast($mdToast, lang.tagOff, 'background-darkred', 'color-white', 'top center');
                    } else if (!dataService.isOutdoor(newTag)) {
                        newSocketService.getData('get_tag_floor', { tag: newTag.id }, (response) => {

                            if (response.result.location_name === undefined || response.result.name === undefined) {
                                $mdDialog.show({
                                    templateUrl: componentsPath + 'tag-not-found-alert.html',
                                    parent: angular.element(document.body),
                                    targetEvent: event,
                                    clickOutsideToClose: true,
                                    controller: ['$scope', '$controller', ($scope, $controller) => {
                                        $controller('languageController', { $scope: $scope });

                                        $scope.title = $scope.lang.tagNotFound.toUpperCase();
                                        $scope.message = $scope.lang.tagNotInitialized;


                                        $scope.hide = () => {
                                            $mdDialog.hide();
                                        }
                                    }],


                                    onRemoving: function() {
                                        $scope.selectedTag = '';
                                    },
                                })
                            } else {
                                $mdDialog.show({
                                    locals: { tags: response.result, outerScope: $scope },
                                    templateUrl: componentsPath + 'search-tag-inside.html',
                                    parent: angular.element(document.body),
                                    targetEvent: event,
                                    clickOutsideToClose: true,
                                    controller: ['$scope', 'tags', 'outerScope', function($scope, tags, outerScope) {
                                        let canvas = null;
                                        let context = null;

                                        $scope.floorData = {
                                            location: '',
                                            floorName: ''
                                        };

                                        $timeout(function() {
                                            canvas = document.querySelector('#search-canvas-id');
                                            context = canvas.getContext('2d');

                                            $scope.floorData.location = response.result.location_name;
                                            $scope.floorData.floorName = response.result.name;

                                            let img = new Image();

                                            img.onload = function() {
                                                canvas.width = this.naturalWidth;
                                                canvas.height = this.naturalHeight;

                                                let round = true;
                                                $interval(function() {

                                                    console.log('redrawing the canvas');
                                                    //updating the canvas and drawing border
                                                    updateCanvas(canvas.width, canvas.height, context, img);

                                                    let tagImg = new Image();

                                                    if (dataService.hasTagSuperatedSecondDelta(newTag)) {
                                                        tagImg.src = tagsIconPath + 'shut_down_tag.png';
                                                    } else {
                                                        dataService.assigningTagImage(newTag, tagImg);
                                                    }

                                                    if (round) {
                                                        tagImg = null;
                                                        round = false;
                                                    } else {
                                                        round = true;
                                                    }

                                                    if (tagImg != null) {
                                                        tagImg.onload = function() {
                                                            drawIcon(newTag, context, tagImg, response.result.width, canvas.width, canvas.height, true);
                                                        }
                                                    }
                                                }, 500);
                                            };
                                            img.src = imagePath + 'floors/' + response.result.image_map;
                                        }, 0);

                                        $scope.hide = () => {
                                            outerScope.selectedTag = '';
                                            $mdDialog.hide();
                                        }
                                    }],
                                    onRemoving: () => {
                                        $scope.selectedTag = '';
                                    }
                                })
                            }
                        });
                    } else {
                        $mdDialog.show({
                            locals: { tagName: newValue, outerScope: $scope },
                            templateUrl: componentsPath + 'search-tag-outside.html',
                            parent: angular.element(document.body),
                            targetEvent: event,
                            clickOutsideToClose: true,
                            controller: ['$scope', 'NgMap', 'tagName', 'outerScope', function($scope, NgMap, tagName, outerScope) {

                                $scope.locationName = '';

                                $scope.mapConfiguration = {
                                    zoom: 8,
                                    map_type: mapType,
                                };

                                let tag = dataService.allTags.find(t => t.name === tagName);

                                newSocketService.getData('get_all_locations', {}, (response) => {

                                    let locations = response.result;


                                    locations.forEach((location) => {
                                        if ((dataService.getTagDistanceFromLocationOrigin(tag, [location.latitude, location.longitude])) <= location.radius) {
                                            $scope.locationName = location.name;
                                        }
                                    });
                                });

                                NgMap.getMap('search-map').then((map) => {
                                    map.set('styles', MAP_CONFIGURATION);
                                    let latLng = new google.maps.LatLng(tag.gps_north_degree, tag.gps_east_degree);

                                    map.setCenter(latLng);
                                    let round = false;
                                    let oldMarker = null;
                                    let marker = null;
                                    $interval(function() {
                                        let tagImg = new Image();
                                        dataService.assigningTagImage(tag, tagImg);
                                        let name = tagImg.src.split('/');

                                        if (round) {
                                            marker = new google.maps.Marker({
                                                position: latLng,
                                                map: map,
                                                icon: tagsIconPath + name[name.length - 1]
                                            });

                                            let infoWindow = new google.maps.InfoWindow({
                                                content: '<div class="marker-info-container">' +
                                                    '<img src="' + iconsPath + 'login-icon.png" class="tag-info-icon" alt="Smart Studio" title="Smart Studio">' +
                                                    '<p class="text-center font-large font-bold color-darkcyan">' + tagName.toUpperCase() + '</p>' +
                                                    '<div><p class="float-left margin-right-10-px">Latitude: </p><p class="float-right"><b>' + tag.gps_north_degree + '</b></p></div>' +
                                                    '<div class="clear-float"><p class="float-left margin-right-10-px">Longitude: </p><p class="float-right"><b>' + tag.gps_east_degree + '</b></p></div>' +
                                                    '</div>'
                                            });

                                            marker.addListener('mouseover', function() {
                                                infoWindow.open(map, this);
                                            });

                                            marker.addListener('mouseout', function() {
                                                infoWindow.close(map, this);
                                            });

                                            round = false;
                                        } else {
                                            if (marker !== null)
                                                marker.setMap(null);
                                            round = true;
                                        }
                                    }, 500);
                                });

                                $scope.hide = () => {
                                    outerScope.selectedTag = '';
                                    $mdDialog.hide();
                                }
                            }],
                            onRemoving: () => {
                                $scope.selectedTag = '';
                            }
                        })
                    }
                }
            }
        });

        /**
         * Function that handles the search of the anchors
         */
        $scope.$watch('selectedAnchor', function(newValue) {

            let newStringValue = "" + newValue;
            if (newStringValue !== '') {

                let newAnchor = $scope.menuAnchors.find(a => a.name === newValue);

                if (newAnchor !== undefined) {
                    $mdDialog.show({
                        locals: { anchor: newAnchor },
                        templateUrl: componentsPath + 'search-tag-inside.html',
                        parent: angular.element(document.body),
                        targetEvent: event,
                        clickOutsideToClose: true,
                        controller: ['$scope', 'anchor', function($scope, anchor) {
                            let canvas = null;
                            let context = null;

                            $scope.floorData = {
                                location: '',
                                floorName: ''
                            };

                            newSocketService.getData('get_floor_info', {
                                location: dataService.location.name,
                                floor: anchor.floor_name
                            }, (response) => {
                                $timeout(function() {
                                    canvas = document.querySelector('#search-canvas-id');
                                    context = canvas.getContext('2d');

                                    $scope.floorData.location = dataService.location.name;
                                    $scope.floorData.floorName = response.result[0].name;

                                    let img = new Image();

                                    img.onload = function() {
                                        canvas.width = this.naturalWidth;
                                        canvas.height = this.naturalHeight;

                                        let round = true;
                                        $interval(function() {
                                            //updating the canvas and drawing border
                                            updateCanvas(canvas.width, canvas.height, context, img);

                                            let anchorImg = new Image();
                                            anchorImg.src = './img/icons/tags/anchor_online_24.png';

                                            if (round) {
                                                anchorImg = null;
                                                round = false;
                                            } else {
                                                round = true;
                                            }

                                            if (anchorImg !== null) {
                                                anchorImg.onload = function() {
                                                    drawIcon(newAnchor, context, anchorImg, response.result[0].width, canvas.width, canvas.height, false);
                                                }
                                            }
                                        }, 500);
                                    };

                                    img.src = imagePath + 'floors/' + response.result[0].image_map;
                                }, 0);

                            });

                            $scope.hide = () => {
                                $scope.selectedAnchor = '';
                                $mdDialog.hide();
                            }
                        }],
                        onRemoving: () => {
                            $scope.selectedAnchor = '';
                        }
                    })
                }
            }
        });

        /**
         * Function that handles the fullscreen switch
         */
        $scope.$watch('switch.mapFullscreen', function(newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('body'));
                $mdSidenav('left').close();
            } else if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement ||
                document.msFullscreenElement) {
                document.exitFullscreen();
                $scope.switch.mapFullscreen = false;
            }
        });

        // switching off the fullscreen when closing from esc button
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
                $scope.switch.mapFullscreen = false;
            }
        });

        /**
         * Function that handeles the drawing of a rectangular zone in an outdoor location
         */
        $scope.$watch('switch.showOutdoorRectDrawing', function(newValue) {
            if (newValue) {
                NgMap.getMap('outdoor-map').then((map) => {

                    dataService.drawingManagerRect.setMap(map);

                    google.maps.event.addListener(dataService.drawingManagerRect, 'rectanglecomplete', function(rectangle) {
                        let data = {
                            x_left: rectangle.getBounds().getNorthEast().lat(),
                            y_up: rectangle.getBounds().getNorthEast().lng(),
                            x_right: rectangle.getBounds().getSouthWest().lat(),
                            y_down: rectangle.getBounds().getSouthWest().lng(),
                            color: '#FF0000',
                            location: dataService.location.name
                        };

                        let stringified = JSON.stringify(data);

                        newSocketService.getData('insert_outdoor_rect_zone', { data: stringified }, (response) => {

                            //TODO add toast
                            dataService.outdoorZoneInserted = true;
                        });
                    });
                });
            } else {
                if (dataService.drawingManagerRect !== null)
                    dataService.drawingManagerRect.setMap(null);
                if (dataService.outdoorZoneInserted)
                    window.location.reload();
            }
        });

        /**
         * Function that handeles the drawing of a circular zone in an outdoor location
         */
        $scope.$watch('switch.showOutdoorRoundDrawing', function(newValue) {
            if (newValue) {
                NgMap.getMap('outdoor-map').then((map) => {

                    dataService.drawingManagerRound.setMap(map);

                    google.maps.event.addListener(dataService.drawingManagerRound, 'circlecomplete', function(circle) {
                        let data = {
                            x: circle.getCenter().lat(),
                            y: circle.getCenter().lng(),
                            radius: circle.getRadius() / 111000,
                            color: '#FF0000',
                            location: dataService.location.name
                        };

                        let stringified = JSON.stringify(data);

                        newSocketService.getData('insert_outdoor_round_zone', { data: stringified }, (response) => {

                            //TODO add toast
                            dataService.outdoorZoneInserted = true;
                        });
                    });
                });
            } else {
                if (dataService.drawingManagerRound !== null)
                    dataService.drawingManagerRound.setMap(null);
                if (dataService.outdoorZoneInserted)
                    window.location.reload();
            }
        });

        $scope.muteAlarms = () => {
            $scope.alertButtonColor = 'background-green';
            dataService.playAlarm = false;
            $timeout(function() {
                $scope.alertButtonColor = 'background-red';
            }, 5000);
        }
    }

    /**
     * Funciton that handles the change password request
     * @type {string[]}
     */
    recoverPassController.$inject = ['$scope', '$state', 'recoverPassService', '$location'];

    function recoverPassController($scope, $state, recoverPassService) {
        $scope.email = '';
        $scope.code = '';
        $scope.username = '';
        $scope.password = '';
        $scope.rePassword = '';
        $scope.error = '';
        $scope.errorHandeling = { noConnection: false, wrongData: false, passwordNotMatch: false };

        //sending the recoverPassword request
        $scope.sendRecoverPassword = (form) => {
            form.$submitted = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData = false;

            let promise = recoverPassService.recoverPassword($scope.email);

            promise
                .then((response) => {
                    if (response.data.response) {
                        $state.go('recover-password-code');
                    } else {
                        $scope.errorHandeling.wrongData = true;
                    }
                })
                .catch((error) => {
                    $scope.errorHandeling.noConnection = true;
                    console.log('recoverPassword error => ', error);
                })
        };

        //reseting the password
        $scope.resetPassword = (form) => {
            form.$submitted = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData = false;
            $scope.errorHandeling.passwordNotMatch = false;

            if ($scope.password !== $scope.rePassword) {
                $scope.errorHandeling.passwordNotMatch = true;
            } else {

                let promise = recoverPassService.resetPassword($scope.code, $scope.username, $scope.password, $scope.rePassword);

                promise
                    .then((response) => {
                        if (response.data.response) {
                            $state.go('login');
                        } else {
                            $scope.errorHandeling.wrongData = true;
                            $scope.error = response.data.message;
                        }
                    }).catch((error) => {
                        $scope.errorHandeling.noConnection = true;
                        console.log('resetPassword error => ', error);
                    })
            }
        }
    }
})();
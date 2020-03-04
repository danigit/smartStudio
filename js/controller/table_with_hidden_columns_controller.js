(function() {
    'use strict';

    angular.module('main').controller('fancyTableController', fancyTableController);

    /**
     * Function that manges the home page including:
     * * locations on the map
     * * general alarms
     * @type {string[]}
     */
    fancyTableController.$inject = ['$rootScope', '$scope', '$state', '$mdDialog', '$interval', '$timeout', 'NgMap', 'dataService', 'newSocketService', 'homeService', '$mdToast'];

    function fancyTableController($rootScope, $scope, $state, $mdDialog, $interval, $timeout, NgMap, dataService, newSocketService, homeService, $mdToast) {
        let table_controller = this;

        $scope.openLocations1 = () => {
            console.log('opening fancy');
            dataService.homeTimer = dataService.stopTimer(dataService.homeTimer);

            let locationsHasChanged     = false;

            let locationDialog = {
                locals             : {admin: $scope.isAdmin, userManager: $scope.isUserManager},
                templateUrl        : componentsPath + 'table-with-hidden-columns.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', 'admin', 'userManager', function ($scope, admin, userManager) {
                    $scope.selected       = [];
                    $scope.locationsTable = [];
                    $scope.isAdmin        = admin;
                    $scope.isUserManager  = userManager;
                    $scope.query          = {
                        limitOptions: [5, 10, 15],
                        limit       : 5,
                        page        : 1
                    };

                    $scope.items = [0, 1, 2, 3, 4, 5];
                    $scope.columns = [0, 1, 3];

                    $scope.toggle = function (item, list) {
                        console.log(list);
                        var idx = list.indexOf(item);
                        console.log(idx);
                        if (idx > -1) {
                            list.splice(idx, 1);
                        }
                        else {
                            list.push(item);
                        }
                    };

                    $scope.exists = function (item, list) {
                        console.log(item);
                        console.log(list);
                        return list.indexOf(item) > -1;
                    };

                    /**
                     * Function that recover the locations
                     */
                    let updateLocationTable = () => {
                        newSocketService.getData('get_locations_by_user', {user: dataService.user.username}, (response) => {

                            $scope.locationsTable = response.result;
                            // $scope.items = Array.from(Array(Object.keys(response.result[0]).length).keys());
                            // $scope.items.forEach(i => $scope.sel.push(i))
                            $scope.$apply();
                        });
                    };

                    updateLocationTable();

                    $rootScope.$on('updateLocationTable', function () {
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
                                modelValue : location[locationName],
                                save       : function (input) {
                                    input.$invalid         = true;
                                    location[locationName] = input.$modelValue;
                                    newSocketService.getData('change_location_field', {
                                        location_id   : location.id,
                                        location_field: locationName,
                                        field_value   : input.$modelValue
                                    }, (response) => {
                                        if (response.result !== 1){
                                            locationsHasChanged = true;
                                            dataService.showToast($mdToast, lang.locationFieldNotChanged, 'background-darkred', 'color-white');
                                        } else {
                                            dataService.showToast($mdToast, lang.locationFieldChanged, 'background-lightgreen', 'color-black');
                                        }
                                    });
                                },
                                targetEvent: event,
                                title      : lang.insertValue,
                                validators : {
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
                            newSocketService.getData('delete_location', {location_id: location.id}, (response) => {

                                if (response.result.length === 0) {
                                    $scope.locationsTable = $scope.locationsTable.filter(t => t.id !== location.id);
                                    locationsHasChanged = true;
                                    $scope.$apply();
                                    dataService.showToast($mdToast, lang.locationDeleted, 'background-lightgreen', 'color-black', 'top center');
                                } else{
                                    dataService.showToast($mdToast, lang.imposibleDeleteLocation, 'background-darkred', 'color-white', 'top center');
                                }
                            });
                        }, function () {
                            console.log('CANCELLATO!!!!');
                        });
                    };

                    //adding a location
                    $scope.addNewRow = () => {
                        $mdDialog.show(addLocationDialog);
                    };

                    $scope.hide = () => {
                        $mdDialog.hide();
                    }
                }],
                onRemoving         : function () {
                    if (dataService.homeTimer === undefined && !locationsHasChanged) {
                        NgMap.getMap('main-map').then((map) => {
                            $rootScope.$emit('constantUpdateNotifications', map);
                        })
                    }
                    if (locationsHasChanged) {
                        locationsHasChanged     = false;
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
                templateUrl        : componentsPath + 'insert-location.html',
                parent             : angular.element(document.body),
                clickOutsideToClose: true,
                multiple           : true,
                controller         : ['$scope', function ($scope) {
                    let fileInput = null;

                    $scope.location = {
                        name       : '',
                        description: '',
                        latitude   : '',
                        longitude  : '',
                        radius     : '',
                        meterRadius: '',
                        showSuccess: false,
                        showError  : false,
                        isIndoor   : false,
                        message    : '',
                        resultClass: ''
                    };

                    //insert location dialog
                    $scope.insertLocation = (form) => {
                        form.$submitted = true;

                        // control if the form is valid
                        if (form.$valid) {
                            let file     = null;
                            let fileName = null;

                            // controll if the file is selected
                            if (fileInput != null && fileInput.files.length !== 0) {
                                file     = fileInput.files[0];
                                fileName = file.name;
                            }

                            // updating the database
                            newSocketService.getData('insert_location', {
                                user       : dataService.user.id,
                                name       : $scope.location.name,
                                description: $scope.location.description,
                                latitude   : $scope.location.latitude,
                                longitude  : $scope.location.longitude,
                                imageName  : (fileName === null) ? '' : fileName,
                                radius     : ($scope.location.isIndoor) ? '' : ($scope.location.radius === '') ? 0 : $scope.location.radius,
                                meterRadius: ($scope.location.isIndoor) ? '' : ($scope.location.radius === '') ? 0 : $scope.location.meterRadius,
                                is_indoor  : $scope.location.isIndoor
                            }, (response) => {

                                // controlling the result
                                if (response.result.length === 0) {
                                    if (file != null) {
                                        convertImageToBase64(file)
                                            .then((images) => {
                                                if (images !== null) {
                                                    newSocketService.getData('save_marker_image', {
                                                        imageName: fileName,
                                                        image    : images
                                                    }, (savedImage) => {
                                                        if (savedImage.result === false) {
                                                            locationsHasChanged = true;
                                                            $scope.location.showSuccess = false;
                                                            $scope.location.showError   = true;
                                                            $scope.location.message     = lang.positionInsertedWithoutImage;
                                                            $scope.location.resultClass = 'background-orange';
                                                            $rootScope.$emit('updateLocationTable', {});
                                                            $scope.$apply();

                                                            //TODO insert toast
                                                            $timeout(function () {
                                                                $mdDialog.hide();
                                                            }, 1000);
                                                        } else {
                                                            locationsHasChanged = true;
                                                            $scope.location.resultClass = 'background-green';
                                                            $scope.location.showSuccess = true;
                                                            $scope.location.showError   = false;
                                                            $scope.location.message     = lang.positionInserted;
                                                            $rootScope.$emit('updateLocationTable', {});
                                                            $scope.$apply();
                                                            //TODO insert toast
                                                            $timeout(function () {
                                                                $mdDialog.hide();
                                                            }, 1000);
                                                        }
                                                    });
                                                }
                                            })
                                    } else {
                                        locationsHasChanged = true;
                                        $scope.location.showSuccess = true;
                                        $scope.location.showError   = false;
                                        $scope.location.message     = lang.positionInsertedWithoutImage;
                                        $scope.location.resultClass = 'background-orange';
                                        $rootScope.$emit('updateLocationTable', {});
                                        $scope.$apply();
                                        //TODO insert toast
                                        $timeout(function () {
                                            $mdDialog.hide();
                                        }, 1000);
                                    }
                                } else {
                                    $scope.location.showSuccess = false;
                                    $scope.location.showError   = true;
                                    $scope.location.message     = lang.impossibleToInsertPosition;
                                    $scope.location.resultClass = 'background-red';
                                    $scope.$apply();
                                    //TODO insert toast
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

    }
})();
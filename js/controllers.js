(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');

    //CONTROLLERS
    main.controller('loginController', loginController);
    main.controller('homeController', homeController);
    main.controller('recoverPassController', recoverPassController);
    main.controller('mapController', mapController);
    main.controller('canvasController', canvasController);
    main.controller('registryController', registryController);
    main.controller('anchorsController', anchorsController);
    main.controller('menuController', menuController);

    /**
     * Function that manage the user login functionalities
     * @type {string[]}
     */
    loginController.$inject = ['$scope', '$location', 'socketService', '$state'];
    function loginController($scope, $location, socketService, $state) {
        $scope.user = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false};

        // function that makes the log in of the user
        $scope.login = function(form){
            form.$submitted = 'true';

            console.log('logging in');
            socketService.getSocket('login', {username: $scope.user.username, password: $scope.user.password}).then(
                function (message) {
                    console.log(message);
                    let mess = JSON.parse(message.data);

                    if (mess.result !== "ERROR_ON_LOGIN"){
                        console.log(mess.result);
                        // dataService.username = $scope.user.username;
                        $state.go('home');
                    } else{
                        $scope.errorHandeling.noConnection = false;
                        $scope.errorHandeling.wrongData    = true;
                    }
                    $scope.$apply();
                }
            ).catch(
                function () {
                    $scope.errorHandeling.wrongData = false;
                    $scope.errorHandeling.noConnection = true;
                }
            )
        };

        $scope.recoverPassword = function () {
          $location.path('/recover-password');
        }
    }

    /**
     * Function that manges the home page functionalities
     * @type {string[]}
     */
    homeController.$inject = ['$scope', '$state', 'NgMap', 'homeData', 'socketService'];
    function homeController($scope, $state, NgMap, homeData, socketService) {
        let vm = this;
        let markers = homeData.markers;
        $scope.isAdmin = (homeData.isAdmin === 1);

        $scope.mapConfiguration = {
            zoom: 7,
            map_type: 'TERRAIN',
            center: [41.87194, 12.56738]
        };

        vm.dynamicMarkers = [];

        NgMap.getMap().then(function(map) {
            let bounds = new google.maps.LatLngBounds();

            for (let i = 0; i < markers.result.length; i++) {
                let latLng = new google.maps.LatLng(markers.result[i].position[0], markers.result[i].position[1]);
                console.log(markers.result[i].icon);
                let marker = new google.maps.Marker({
                    position:latLng,
                    icon: '../img/markers-images/' + markers.result[i].icon
                });

                google.maps.event.addDomListener(marker, 'click', function () {
                    console.log(markers.result[i].name);
                    socketService.getSocket('save_location', {location: markers.result[i].name})
                        .then(function (result) {
                            let message = JSON.parse(result.data);
                            if (message.result === 'location_saved')
                                $state.go('canvas');
                        })
                });

                vm.dynamicMarkers.push(marker);
                bounds.extend(marker.getPosition());
            }

            vm.markerClusterer = new MarkerClusterer(map, vm.dynamicMarkers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
            map.setCenter(bounds.getCenter());
            map.fitBounds(bounds);
        });
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    mapController.$inject = ['$location', '$scope', '$timeout', 'NgMap', 'loginService', 'socketService', 'dataService'];
    function mapController( $location, $scope, $timeout, NgMap, loginService, socketService, dataService) {}

    /**
     * Function that handles the canvas interaction
     * @type {string[]}
     */
    canvasController.$inject = ['$scope', '$location', '$mdDialog', '$timeout', '$interval', 'canvasService', 'socketService', 'menuService', 'canvasData', 'dataService'];
    function canvasController($scope, $location, $mdDialog, $timeout, $interval, canvasService, socketService, menuService, canvasData, dataService){
        $scope.floorData = {
            defaultFloorName: canvasData.floors[0].name,
            gridSpacing: canvasData.floors[0].map_spacing,
            location: canvasData.location,
        };

        $scope.floors = canvasData.floors;
        $scope.defaultFloor = canvasData.floors[0];

        $scope.switch = {
            showGrid: true,
            showAnchors: true,
            showCameras: true,
            showRadius: true,
            showDrawing: false,
            showFullscreen: false,
        };

        // $scope.isOpen = false;
        // $scope.speedDial = {
        //     isOpen: false,
        //     selectedDirection: 'left',
        //     mode: 'md-scale',
        //     fullscreen: false,
        //     gridSpacing: 0,
        // };

        let canvas = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');

        $scope.$watchGroup(['switch.showGrid', 'switch.showAnchors', 'switch.showCameras', 'floorData.gridSpacing', 'switch.showDrawing'], function (newValues) {
            $scope.defaultFloor.map_spacing = newValues[3];

            if (!newValues[4])
                $scope.loadFloor(newValues[0], newValues[1], newValues[2]);
            else
                $scope.loadFloor(false, false, false)
        });

        $scope.$watch('switch.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                $scope.switch.fullscreen = false;
            }
        });

        $scope.$watch('floorData.defaultFloorName', function (newValue) {
            $scope.defaultFloor = $scope.floors.filter(f => { return f.name === newValue})[0];
            if ($scope.floorData.gridSpacing === $scope.defaultFloor.map_spacing)
                $scope.loadFloor(true, true, true);
            else
                $scope.floorData.gridSpacing = $scope.defaultFloor.map_spacing;
        });

        $scope.loadFloor = function(grid, anchors, cameras){

            console.log('loading floor');
            let img = new Image();
            img.src = imagePath + 'floors/' + $scope.defaultFloor.image_map;

            img.onload = function() {
                canvas.width = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(canvas, context, img);

                if (grid) {
                    //drawing vertical
                    drawDashedLine(canvas, context, canvas.height, [5, 5], $scope.defaultFloor.map_spacing, $scope.defaultFloor.width, 'vertical');
                    //drawing horizontal lines
                    drawDashedLine(canvas, context, canvas.width, [5, 5], $scope.defaultFloor.map_spacing, $scope.defaultFloor.width, 'horizontal');
                }


                socketService.getSocket('get_anchors_by_floor', {floor: $scope.floorData.defaultFloorName})
                    .then(function (response) {
                        let message = JSON.parse(response.data);
                        dataService.anchors = message.result;
                        if (anchors)
                            showAnchors(message.result);

                        return socketService.getSocket('get_cameras', {floor: $scope.floorData.defaultFloorName})
                    })
                    .then(function (response) {
                        let message = JSON.parse(response.data);
                        if (cameras)
                            showCameras(message.result);

                        return socketService.getSocket('get_tags_by_floor', {floor: $scope.defaultFloor.id});
                    })
                    .then(function (response) {
                        let message = JSON.parse(response.data);
                        showWeTag(message.result);
                    })
            };
        };

        let showAnchors = function(result){
            let img = new Image();
            img.src = imagePath + 'icons/ancora-icon.png';

            img.onload = function () {
                drawIcon(result, context, img, $scope.defaultFloor.width, canvas, false);
            };
        };


        let showCameras = function(result){
            let img = new Image();
            img.src = imagePath + 'icons/camera.png';

            img.onload = function () {
                console.log(result);
                drawIcon(result, context, img, $scope.defaultFloor.width, canvas, false);
            };
        };

        let showWeTag = function (result) {
            let img = new Image();
            img.src = imagePath + 'icons/tag-green.png';

            img.onload = function () {
                drawIcon(result, context, img, $scope.defaultFloor.width, canvas, true);
            }
        };

        let constantUpdateCanvas = function(){
            let bufferCanvas = document.createElement('canvas');
            let bufferContext = bufferCanvas.getContext('2d');

            let img = new Image();
            img.src = imagePath + 'floors/' + $scope.defaultFloor.image_map;

            img.onload = function() {
                bufferCanvas.width = this.naturalWidth;
                bufferCanvas.height = this.naturalHeight;

                $interval(function () {
                    let grid = $scope.switch.showGrid;
                    let anchors = $scope.switch.showAnchors;
                    let cameras = $scope.switch.showCameras;

                    //updating the canvas and drawing border
                    updateCanvas(bufferCanvas, bufferContext, img);

                    if (grid) {
                        //drawing vertical
                        drawDashedLine(bufferCanvas, bufferContext, canvas.height, [5, 5], $scope.defaultFloor.map_spacing, $scope.defaultFloor.width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(bufferCanvas, bufferContext, canvas.width, [5, 5], $scope.defaultFloor.map_spacing, $scope.defaultFloor.width, 'horizontal');
                    }

                    socketService.getSocket('get_anchors_by_floor', {floor: $scope.floorData.defaultFloorName})
                        .then(function (response) {
                            let message         = JSON.parse(response.data);
                            dataService.anchors = message.result;

                            if (anchors) {
                                let img = new Image();
                                img.src = imagePath + 'icons/ancora-icon.png';

                                img.onload = function () {
                                    drawIcon(message.result, bufferContext, img, $scope.defaultFloor.width, bufferCanvas, false);
                                };
                            }

                            return socketService.getSocket('get_cameras', {floor: $scope.floorData.defaultFloorName})
                        })
                        .then(function (response) {
                            let message = JSON.parse(response.data);

                            if (cameras) {
                                let img = new Image();
                                img.src = imagePath + 'icons/camera.png';

                                img.onload = function () {
                                    drawIcon(message.result, bufferContext, img, $scope.defaultFloor.width, bufferCanvas, false);
                                };
                            }
                            return socketService.getSocket('get_tags_by_floor', {floor: $scope.defaultFloor.id});
                        })
                        .then(function (response) {
                            let message = JSON.parse(response.data);

                            let img = new Image();
                            img.src = imagePath + 'icons/tag-green.png';

                            img.onload = function () {
                                drawIcon(message.result, bufferContext, img, $scope.defaultFloor.width, bufferCanvas, true);

                                context.drawImage(bufferCanvas, 0, 0);
                            }

                        })
                }, 1000);
            }
        };

        constantUpdateCanvas();
    }

    menuController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', '$location', '$state', '$filter', '$timeout', '$mdSidenav', 'dataService', 'menuService', 'socketService'];
    function menuController($scope, $mdDialog, $mdEditDialog, $location, $state, $filter, $timeout, $mdSidenav, dataService, menuService, socketService){

        $scope.toggleLeft = function(){
            $mdSidenav('left').toggle();
        };

        $scope.insertLocation = function(){
            $mdDialog.show({
                templateUrl: '../components/insert-location.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function ($scope) {
                    let fileInput = null;

                    $scope.location = {
                        name: '',
                        description: '',
                        latitude: '',
                        longitude: '',
                        showSuccess: false,
                        showError: false,
                        message: '',
                        resultClass: ''
                    };

                    $scope.insertLocation = function(form){
                        form.$submitted = true;

                        if (form.$valid) {
                            let file = null;
                            let fileName = null;

                            if (fileInput != null && fileInput.files.length !== 0) {
                                file = fileInput.files[0];
                                fileName = file.name;
                            }

                            socketService.getSocket('get_user', {})
                                .then(
                                function (response) {
                                    let user = JSON.parse(response.data);

                                    return socketService.getSocket('insert_location', {
                                        user       : user.result.id,
                                        name       : $scope.location.name,
                                        description: $scope.location.description,
                                        latitude   : $scope.location.latitude,
                                        longitude  : $scope.location.longitude,
                                        imageName: fileName,
                                    })
                                })
                                .then(
                                function (result) {
                                    let res = JSON.parse(result.data);
                                    if (res.result !== undefined && res.result !== 0) {
                                        if (file != null){
                                            return convertImageToBase64(file);
                                        }
                                    } else {
                                        $scope.location.showSuccess =  false;
                                        $scope.location.showError =  true;
                                        $scope.location.message = 'Impossibile inserire la posizione.';
                                        $scope.location.resultClass = 'background-red';
                                    }
                                })
                                .then(
                                    function (result) {
                                        return socketService.getSocket('save_marker_image', {imageName: fileName, image: result })
                                })
                                .then(function (result) {
                                    let message = JSON.parse(result.data);

                                    if (message.result === false){
                                        console.log('image not inserted');
                                        $scope.location.showSuccess = false;
                                        $scope.location.showError = true;
                                        $scope.location.message = "Posizione inserita senza salvare l'immagine";
                                        $scope.resultClass = 'background-orange'
                                    }else {
                                        $scope.location.resultClass = 'background-green';
                                        $scope.location.showSuccess = true;
                                        $scope.location.showError = false;
                                        $scope.location.message = 'Posizione inserita con successo';

                                        $scope.$apply();

                                        $timeout(function () {
                                            // $mdDialog.hide();
                                            window.location.reload();
                                        }, 1000);
                                    }
                                }
                            ).catch(function (error) {
                                console.log(error);
                                $scope.location.showSuccess = false;
                                $scope.location.showError = true;
                                $scope.location.message = 'Impossibile inserire la posizione';
                                $scope.location.resultClass = 'background-red';
                            })
                        }else {
                            $scope.location.resultClass = 'background-red';
                        }
                    };

                    $scope.uploadMarkerImage = function(){
                        fileInput = document.getElementById('marker-image');
                        fileInput.click();
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.viewHistory = function(){
            $mdDialog.show({
                templateUrl: '../components/history.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function ($scope) {
                    let from = new Date();
                    from.setDate(from.getDate() - 7);

                    $scope.history = {
                        fromDate: from,
                        toDate: new Date(),
                        tags: null,
                        events: null,
                        selectedTag: null,
                        selectedEvent: null
                    };

                    $scope.query = {
                        limitOptions: [5, 10, 15],
                        order: 'Data',
                        limit: 5,
                        page: 1
                    };

                    $scope.historyRows = [];

                    $scope.$watchGroup(['history.fromDate', 'history.toDate', 'history.selectedTag', 'history.selectedEvent'], function (newValues) {
                        let fromDate = $filter('date')(newValues[0], 'yyyy-MM-dd');
                        let toDate = $filter('date')(newValues[1], 'yyyy-MM-dd');

                        socketService.getSocket('get_events', {})
                            .then(function (response) {
                                console.log(response);
                                let message = JSON.parse(response.data);
                                $scope.history.events = message.result;
                                $scope.history.tags = dataService.tags;
                                $scope.$apply();
                                return socketService.getSocket('get_history', {fromDate: fromDate, toDate: toDate, tag: newValues[2], event: newValues[3]})
                            })
                            .then(function (result) {
                                let mess = JSON.parse(result.data);
                                $scope.historyRows = mess.result;
                                $scope.$apply();
                            }
                        );
                    });

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]

            });
        };

        $scope.changePassword = function () {
            $mdDialog.show({
                templateUrl        : '../components/change-password.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    $scope.changePassword = {
                        oldPassword: '',
                        newPassword: '',
                        reNewPassword: '',
                        resultClass: '',
                        showSuccess: false,
                        showError: false,
                        message: false
                    };

                    $scope.sendPassword = function (form) {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword){
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.showError = true;
                            $scope.changePassword.showSuccess    = false;
                            $scope.changePassword.message = "Le password devono coincidere!";
                        }else{
                            if (form.$valid ) {

                                socketService.getSocket('change_password', {oldPassword: $scope.changePassword.oldPassword, newPassword: $scope.changePassword.newPassword})
                                    .then(function (result) {
                                        let message = JSON.parse(result.data);
                                        if (message.result === 'wrong_old'){
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showError = true;
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.message = 'Vecchia password non valida';
                                        }else if (message.result === 'error_on_changing_password'){
                                            $scope.changePassword.resultClass = 'background-red';
                                            $scope.changePassword.showSuccess = false;
                                            $scope.changePassword.showError = true;
                                            $scope.changePassword.message = "Impossibile cambiare la password!";
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        }else {
                                            $scope.changePassword.resultClass = 'background-green';
                                            $scope.changePassword.showSuccess = true;
                                            $scope.changePassword.showError = false;
                                            $scope.changePassword.message = "Password cambiata correnttamente!";
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 1000);
                                        }
                                        $scope.$apply();
                                    });
                            }else {
                                $scope.changePassword.resultClass = 'background-red';
                            }
                        }
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            });
        };

        $scope.registry = function(){
            $mdDialog.show({
                templateUrl: '../components/change-registry.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function ($scope) {
                    $scope.selected = [];
                    $scope.limitOptions = [5, 10, 15];

                    $scope.query = {
                        order: 'name',
                        limit: 5,
                        page: 1
                    };

                    socketService.getSocket('get_tags_by_location', {location: dataService.location})
                        .then(function (response) {
                            let message = JSON.parse(response.data);
                            $scope.tags = message.result;
                        });

                    $scope.editCell = function(event, tag, tagName) {

                        event.stopPropagation();

                        let editCell = {
                            modelValue: tag[tagName],
                            save: function (input) {
                                input.$invalid = true;
                                tag[tagName] = input.$modelValue;
                                socketService.getSocket('change_tag_field', {tag_id: tag.id, tag_field: tagName, field_value: input.$modelValue})
                                    .then(function (response) {
                                        let message = JSON.parse(response.data);
                                        if (message.result !== 1)
                                            console.log(message.result);
                                    })
                            },
                            targetEvent: event,
                            title: 'Inserisci un valore',
                            validators:{
                                'md-maxlength': 30
                            }
                        };

                        $mdEditDialog.large(editCell);
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        $scope.showAnchorsTable = function() {
            $mdDialog.show({
                templateUrl        : '../components/anchors.html',
                parent             : angular.element(document.body),
                targetEvent        : event,
                clickOutsideToClose: true,
                controller         : ['$scope', function ($scope) {
                    $scope.selected = [];
                    $scope.limitOptions = [5, 10, 15];

                    $scope.query = {
                        order: 'name',
                        limit: 5,
                        page: 1
                    };

                    socketService.getSocket('get_anchors_by_location', {location: dataService.location})
                        .then(function (response) {
                            let message = JSON.parse(response.data);
                            $scope.anchors = message.result;
                        });

                    $scope.editCell = function(event, anchor, anchorName) {

                        event.stopPropagation();

                        let editCell = {
                            modelValue: anchor[anchorName],
                            save: function (input) {
                                input.$invalid = true;
                                anchor[anchorName] = input.$modelValue;
                                socketService.getSocket('change_anchor_field', {anchor_id: anchor.id, anchor_field: anchorName, field_value: input.$modelValue})
                                    .then(function (response) {
                                        let message = JSON.parse(response.data);
                                        if (message.result !== 1)
                                            console.log(message.result);
                                    })
                            },
                            targetEvent: event,
                            title: 'Inserisci un valore',
                            validators:{
                                'md-maxlength': 30
                            }
                        };

                        $mdEditDialog.large(editCell);
                    };

                    $scope.hideAnchors = function () {
                        $mdDialog.hide();
                    };
                }]
            });
        };

        $scope.floorUpdate = function(){
            $mdDialog.show({
                templateUrl: '../components/floor-settings.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function ($scope) {
                    $scope.selected = [];
                    $scope.limitOptions = [5, 10, 15];

                    $scope.query = {
                        order: 'name',
                        limit: 5,
                        page: 1
                    };

                    $scope.floors = dataService.floors;

                    $scope.editCell = function(event, floor, floorName) {

                        event.stopPropagation();

                        let editCell = {
                            modelValue: floor[floorName],
                            save: function (input) {
                                input.$invalid = true;
                                floor[floorName] = input.$modelValue;
                                console.log(floorName);
                                socketService.getSocket('change_floor_field', {floor_id: floor.id, floor_field: floorName, field_value: input.$modelValue})
                                    .then(function (response) {
                                        let message = JSON.parse(response.data);
                                        if (message.result !== 1)
                                            console.log(message.result);
                                    })
                            },
                            targetEvent: event,
                            title: 'Inserisci un valore',
                            validators:{
                                'md-maxlength': 30
                            }
                        };

                        $mdEditDialog.large(editCell);
                    };

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
        };

        //function that makes the logout of the user
        $scope.logout = function () {
            socketService.getSocket('logout', {}).then(
                function (result) {
                    let mess = JSON.parse(result.data);
                    if (mess.result === 'logged_out')
                        $state.go('login');
                }
            )
        };


    }

    registryController.$inject = ['$scope', '$mdDialog', '$timeout', 'socketService'];
    function registryController($scope, $mdDialog, $timeout, socketService){

    }

    anchorsController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', 'socketService'];
    function anchorsController($scope, $mdDialog, $mdEditDialog, socketService){

    }

    /**
     * Funciton that handles the change password request
     * @type {string[]}
     */
    recoverPassController.$inject = ['$scope', 'recoverPassService', '$location'];
    function recoverPassController($scope, recoverPassService, $location) {
        $scope.email = '';
        $scope.code = '';
        $scope.username = '';
        $scope.password = '';
        $scope.rePassword = '';
        $scope.error = '';
        $scope.errorHandeling = {noConnection: false, wrongData: false, passwordNotMatch: false };

        $scope.sendRecoverPassword = function (form) {
            form.$submitted = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData = false;

            let promise = recoverPassService.recoverPassword($scope.email);

            promise.then(
                function (response) {
                    if (response.data.response){
                        $location.path('/recover-password-code')
                    }else {
                        $scope.errorHandeling.wrongData = true;
                    }
                }
            ).catch(
                function () {
                    $scope.errorHandeling.noConnection = true;
                }
            )
        };
        
        $scope.resetPassword = function (form) {
            form.$submitted = 'true';
            $scope.errorHandeling.noConnection = false;
            $scope.errorHandeling.wrongData = false;
            $scope.errorHandeling.passwordNotMatch = false;

            if ($scope.password !== $scope.rePassword){
                $scope.errorHandeling.passwordNotMatch = true;
            }else {

                let promise = recoverPassService.resetPassword($scope.code, $scope.username, $scope.password, $scope.rePassword);

                promise.then(
                    function (response) {
                        if (response.data.response) {
                            $location.path('/');
                        } else {
                            $scope.errorHandeling.wrongData = true;
                            $scope.error = response.data.message;
                        }
                    }
                ).catch(
                    function () {
                        $scope.errorHandeling.noConnection = true;
                    }
                )
            }
        }
    }
})();

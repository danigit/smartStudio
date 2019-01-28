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
    loginController.$inject = ['$scope', '$location', 'loginService'];
    function loginController($scope, $location, loginService) {
        $scope.user = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false};

        // function that makes the log in of the user
        $scope.login = function(form){
            form.$submitted = 'true';

            let promise = loginService.login($scope.user.username, $scope.user.password);

            promise.then(
                function (response) {
                    if (response.data.response) {
                        $location.path('/home');
                    }else{
                        $scope.errorHandeling.noConnection = false;
                        $scope.errorHandeling.wrongData = true;
                    }
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
    homeController.$inject = ['$scope', 'homeService', '$location', 'menuService'];
    function homeController($scope, homeService, $location, menuService) {
        // let map = initMap();

        //function that makes the logout of the user
        $scope.logout = function () {
            let promise = menuService.logout();

            promise.then(
                function (response) {
                    if (response.data.response)
                        $location.path('/');
                }
            )
        };

        $scope.toggleLeft = menuService.toggleLeft('left');
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    mapController.$inject = ['$location', '$scope', 'NgMap', 'loginService', 'socketService'];
    function mapController( $location, $scope, NgMap, loginService, socketService) {
        let vm = this;
        NgMap.getMap().then(map => vm.map = map);
        vm.positions = [];

        let loadMarkers = function(message){
            angular.forEach(message.result, function ( value) {
                vm.positions.push(value);
            });
        };



        // let promise = socketService.getSocket();
        //
        loginService.isLogged().then(
            function (response) {
                if (response.data.response){
                    socketService.sendMessage('get_markers', {username: response.data.username}, loadMarkers);
                }
            }
        );

        // console.log(vm.positions);
        $scope.clickLocation = function (e, index) {
            sessionStorage.setItem('location', vm.positions[index].name);
            $location.path('/canvas');
        }
    }

    /**
     * Function that handles the canvas interaction
     * @type {string[]}
     */
    canvasController.$inject = ['$scope', '$location', '$mdDialog', '$timeout', 'canvasService', 'socketService', 'menuService'];
    function canvasController($scope, $location, $mdDialog, $timeout, canvasService, socketService, menuService){

        $scope.toggleLeft = menuService.toggleLeft('left');

        // $scope.isOpen = false;

        $scope.header = {
            location: sessionStorage.getItem('location'),
            name: ''
        };

        $scope.grid = {
            showGrid: true,
            gridMessage: 'On'
        };

        $scope.anchors = {
            showAnchors: true,
            anchorsMessage: 'On'
        };

        $scope.cameras = {
            showCameras: true,
            camerasMessage: 'On'
        };

        $scope.radius = {
            showRadius: true,
            radiusMessage: 'On'
        };

        $scope.drawing = {
            showDrawing: false,
            drawingMessage: 'Off'
        };

        $scope.speedDial = {
            isOpen: false,
            selectedDirection: 'left',
            mode: 'md-scale',
            fullscreen: false,
            gridSpacing: 0,
        };

        $scope.gridSpacing = 0;

        $scope.floors = {
            defaultFloor: 1
        };

        let canvas = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');

        $scope.$watch('gridSpacing', function (newValue) {
            if (socketService.floor.mapResult !== undefined) {
                socketService.floor.mapResult.map_spacing = newValue;
                context.clearRect(15, 15, canvas.width, canvas.height);
                updateCanvas(canvas, context, socketService.floor.image);

                if (socketService.floor.mapResult.map_width !== undefined) {
                    //drawing vertical
                    drawDashedLine(canvas, context, canvas.height, [5, 5], newValue, socketService.floor.mapResult.map_width, 'vertical');
                    //drawing horizontal lines
                    drawDashedLine(canvas, context, canvas.width, [5, 5], newValue, socketService.floor.mapResult.map_width, 'horizontal');
                    //drawing images
                    if ($scope.anchors.showAnchors)
                        drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                    //draw cameras
                    if ($scope.cameras.showCameras)
                        drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                }
            }
        });

        $scope.$watch('grid.showGrid', function (newValue) {
            if (socketService.floor.mapResult !== undefined) {
                context.clearRect(15, 15, canvas.width, canvas.height);
                updateCanvas(canvas, context, socketService.floor.image);

                if (!newValue) {
                    if (!$scope.drawing.showDrawing) {
                        //drawing anchors
                        drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                        //draw cameras
                        drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                    }
                } else {
                    if (socketService.floor.mapResult.map_width !== undefined) {
                        //drawing vertical
                        drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                        //drawing images
                        if ($scope.anchors.showAnchors)
                            drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                        //draw cameras
                        if ($scope.cameras.showCameras)
                            drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                    }
                }
            }
        });

        $scope.$watch('anchors.showAnchors', function (newValue) {
            if (socketService.floor.mapResult !== undefined) {
                context.clearRect(15, 15, canvas.width, canvas.height);
                updateCanvas(canvas, context, socketService.floor.image);

                if (!newValue) {
                    if ($scope.grid.showGrid) {
                        //drawing vertical
                        drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                    }
                    //draw cameras
                    if ($scope.cameras.showCameras)
                        drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                } else {
                    if (socketService.floor.mapResult.map_width !== undefined) {
                        if ($scope.grid.showGrid) {
                            //drawing vertical
                            drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                            //drawing horizontal lines
                            drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                        }
                        //drawing images
                        drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                        //draw cameras
                        if ($scope.cameras.showCameras)
                            drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                    }
                }
            }
        });

        $scope.$watch('cameras.showCameras', function (newValue) {
            if (socketService.floor.mapResult !== undefined) {
                context.clearRect(15, 15, canvas.width, canvas.height);
                updateCanvas(canvas, context, socketService.floor.image);

                if (!newValue) {
                    if ($scope.grid.showGrid) {
                        //drawing vertical
                        drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                    }
                    //draw cameras
                    if ($scope.anchors.showAnchors)
                        drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                } else {
                    if (socketService.floor.mapResult.map_width !== undefined) {
                        if ($scope.grid.showGrid) {
                            //drawing vertical
                            drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                            //drawing horizontal lines
                            drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                        }
                        //drawing images
                        if ($scope.anchors.showAnchors)
                            drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                        //draw cameras
                        drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                    }
                }
            }
        });

        $scope.$watch('speedDial.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                $scope.speedDial.fullscreen = false;
            }
        });

        $scope.$watch('floors.defaultFloor', function (newValue) {
            socketService.floor.defaultFloor = $scope.floors.defaultFloor;
            if($scope.floors.result !== undefined) {
                socketService.sendMessage('get_floor_info', {location: sessionStorage.getItem('location'), floor: $scope.floors.defaultFloor}, showFloorMap);
                socketService.sendMessage('get_anchors', {floor: $scope.floors.defaultFloor}, showAnchors);
                socketService.sendMessage('get_cameras', {floor: $scope.floors.defaultFloor}, showCameras);
            }
        });

        $scope.$watch('radius.showRadisu', function (newValue) {
            if (socketService.floor.mapResult !== undefined) {
                context.clearRect(15, 15, canvas.width, canvas.height);
                updateCanvas(canvas, context, socketService.floor.image);

                if (!newValue) {
                    if ($scope.grid.showGrid) {
                        //drawing vertical
                        drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                        //drawing horizontal lines
                        drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                    }
                    //draw cameras
                    if ($scope.anchors.showAnchors)
                        drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);
                    if ($scope.cameras.showCameras)
                        drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                } else {
                    if (socketService.floor.mapResult.map_width !== undefined) {
                        if ($scope.grid.showGrid) {
                            //drawing vertical
                            drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');
                            //drawing horizontal lines
                            drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal');
                        }
                        //drawing images
                        if ($scope.anchors.showAnchors)
                            drawIcon(socketService.floor.anchorsResult, context, socketService.floor.anchorImage, socketService.floor.mapResult.map_width, canvas);

                        //draw cameras
                        if ($scope.cameras.showCameras)
                         drawIcon(socketService.floor.camerasResult, context, socketService.floor.cameraImage, socketService.floor.mapResult.map_width, canvas);
                    }
                }
            }
        });

        $scope.$watch('drawing.showDrawing', function (newValue) {
            context.clearRect(15, 15, canvas.width, canvas.height);
            updateCanvas(canvas, context, socketService.floor.image);

            if (!newValue){
                $scope.grid.showGrid = true;
                $scope.anchors.showAnchors = true;
                $scope.cameras.showCameras = true;
            }else{
                $scope.grid.showGrid = false;
                $scope.anchors.showAnchors = false;
                $scope.cameras.showCameras = false;
            }
        });

        let showFloorMap = function(message){

            $scope.header.name = message.result[0].name;
            $scope.gridSpacing = message.result[0].map_spacing;

            socketService.floor.mapResult = message.result[0];

            let img = new Image();
            img.src = imagePath + 'floors/' + message.result[0].image_map;

            img.onload = function() {
                socketService.floor.image = img;
                canvas.width = this.naturalWidth;
                canvas.height = this.naturalHeight;

                //updating the canvas and drawing border
                updateCanvas(canvas, context, img);

                if ($scope.grid.showGrid) {
                    //drawing vertical
                    drawDashedLine(canvas, context, canvas.height, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'vertical');

                    //drawing horizontal lines
                    drawDashedLine(canvas, context, canvas.width, [5, 5], socketService.floor.mapResult.map_spacing, socketService.floor.mapResult.map_width, 'horizontal')
                }
            };
        };

        let showAnchors = function(message){
            socketService.floor.anchorsResult = message.result;

            let img = new Image();
            img.src = imagePath + 'ancora-icon.png';

            socketService.floor.anchorImage = img;

            img.onload = function () {
                drawIcon(message.result, context, img, socketService.floor.mapResult.map_width, canvas);
            };
        };

        let showCameras = function(message){
            socketService.floor.camerasResult = message.result;

            let img = new Image();
            img.src = imagePath + 'icons/camera.png';

            socketService.floor.cameraImage = img;

            img.onload = function () {
              drawIcon(message.result, context, img, socketService.floor.mapResult.map_width, canvas);
            };
        };

        let getFloors = function(message){
          $scope.floors.result = message.result;
          $scope.floors.defaultFloor = message.result[0].name;
        };

        socketService.sendMessage('get_floor_info', {location: sessionStorage.getItem('location'), floor: 'floor 1'}, showFloorMap);
        socketService.sendMessage('get_anchors', {floor: 'floor 1'}, showAnchors);
        socketService.sendMessage('get_cameras', {floor: 'floor 1'}, showCameras);
        socketService.sendMessage('get_floors', {location: sessionStorage.getItem('location')}, getFloors);
    }

    menuController.$inject = ['$scope', '$mdDialog', '$mdEditDialog', '$location', '$timeout', 'menuService', 'socketService'];
    function menuController($scope, $mdDialog, $mdEditDialog, $location, $timeout, menuService, socketService){
        $scope.registry = function(){
            $mdDialog.show({
                templateUrl: '../components/change-registry.html',
                parent: angular.element(document.body),
                targetEvent: event,
                clickOutsideToClose: true,
                controller: ['$scope', function ($scope) {
                    $scope.registry = {
                        tag: null,
                        tags: null,
                        name: '',
                        resultOk: false,
                        resultError: false,
                        fieldsEmpty: false,
                        resultClass: ''
                    };

                    let getTags = function(message){
                        $scope.registry.tags = message.result;
                    };

                    let sendTagChange = function(message){
                        if (message.result === 1 || message.result === 0) {
                            $scope.registry.resultOk = true;
                            $scope.registry.resultError = false;
                            $scope.registry.fieldsEmpty = false;
                            $scope.registry.resultClass = 'background-green';
                            $timeout(function () {
                                $mdDialog.hide();
                            }, 2000)
                        }else if (message.result === 0) {
                            $scope.registry.resultOk = false;
                            $scope.registry.resultError = true;
                            $scope.registry.fieldsEmpty = false;
                            $scope.registry.resultClass = 'background-red';
                        }

                        $scope.$apply();
                    };

                    $scope.changeTagName = function (form) {
                        form.$submitted = true;
                        if ($scope.registry.tag != null && $scope.registry.name !== ''){
                            socketService.sendMessage('change_tag_name', {tag: $scope.registry.tag, name: $scope.registry.name}, sendTagChange)
                        }else {
                            $scope.registry.resultClass = 'background-red';
                        }
                    };

                    socketService.sendMessage('get_tags', {location: sessionStorage.getItem('location')}, getTags);

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

                    $scope.anchors = [];

                    $scope.editCell = function(event, anchor, anchorName) {

                        event.stopPropagation();

                        let editCell = {
                            modelValue: anchor[anchorName],
                            save: function (input) {
                                input.$invalid = true;
                                anchor[anchorName] = input.$modelValue;
                                socketService.sendMessage('change_anchor_field', {anchor_id: anchor.id, anchor_field: anchorName, field_value: input.$modelValue}, function () {})
                            },
                            targetEvent: event,
                            title: 'Inserisci un valore',
                            validators:{
                                'md-maxlength': 30
                            }
                        };

                        let promise = $mdEditDialog.large(editCell);

                        promise.then(function (ctrl) {
                            let input = ctrl.getInput();
                            // console.log(input);

                            input.$viewChangeListeners.push(function () {
                                console.log($scope.anchors);
                                input.$setValidity('test', input.$modelValue !== 'test');
                            });
                        })
                    };

                    function getAnchors(message) {
                        $scope.anchors = message.result;
                    }

                    socketService.sendMessage('get_anchors', {floor: 'floor 1'}, getAnchors);

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

                    $scope.floors = [];

                    $scope.editCell = function(event, floor, floorName) {

                        event.stopPropagation();

                        let editCell = {
                            modelValue: floor[floorName],
                            save: function (input) {
                                input.$invalid = true;
                                floor[floorName] = input.$modelValue;
                                socketService.sendMessage('change_floor_field', {floor_id: floor.id, floor_field: floorName, field_value: input.$modelValue}, function () {})
                            },
                            targetEvent: event,
                            title: 'Inserisci un valore',
                            validators:{
                                'md-maxlength': 30
                            }
                        };

                        let promise = $mdEditDialog.large(editCell);

                        promise.then(function (ctrl) {
                            let input = ctrl.getInput();

                            input.$viewChangeListeners.push(function () {
                                console.log($scope.anchors);
                                input.$setValidity('test', input.$modelValue !== 'test');
                            });
                        })
                    };

                    let getFloors = function(message){
                        console.log(message.result)
                        $scope.floors = message.result;
                    };

                    socketService.sendMessage('get_floors', {location: sessionStorage.getItem('location')}, getFloors);

                    $scope.hide = function () {
                        $mdDialog.hide();
                    }
                }]
            })
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
                        resultOk: false,
                        wrongOld: false,
                        resultError: false
                    };

                    $scope.sendPassword = function (form) {
                        form.$submitted = true;

                        if ($scope.changePassword.newPassword !== $scope.changePassword.reNewPassword){
                            $scope.changePassword.resultClass = 'background-red';
                            $scope.changePassword.resultError = true;
                            $scope.changePassword.resultOk    = false;
                            $scope.changePassword.wrongOld = false;
                        }else{
                            if (form.$valid ) {
                                let promise = menuService.sendPassword($scope.changePassword.oldPassword, $scope.changePassword.newPassword);

                                promise.then(
                                    function (response) {
                                        if (response.data.response) {
                                            if (response.data.result === 1 || response.data.result === 0) {
                                                $scope.changePassword.resultClass = 'background-green';
                                                $scope.changePassword.resultOk    = true;
                                                $scope.changePassword.resultError = false;
                                                $scope.changePassword.wrongOld    = false;
                                                $timeout(function () {
                                                    $mdDialog.hide();
                                                }, 2000)
                                            }
                                        } else {
                                            if ($scope.changePassword.oldPassword !== '' && $scope.changePassword.newPassword !== '' &&
                                                $scope.changePassword.reNewPassword !== '') {
                                                $scope.changePassword.resultOk    = false;
                                                $scope.changePassword.resultError = false;
                                                $scope.changePassword.wrongOld    = true;
                                                $scope.changePassword.resultClass = 'background-red';
                                            }
                                        }
                                    }
                                )
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

        //function that makes the logout of the user
        $scope.logout = function () {
            let promise = menuService.logout();

            promise.then(
                function (response) {
                    if (response.data.response)
                        $location.path('/');
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

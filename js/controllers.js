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

        let promise = socketService.getSocket();

        loginService.isLogged().then(
            function (response) {
                if (response.data.response){
                    promise.then(
                        function (socket) {
                            socket.send(encodeRequest('get_markers', {username: response.data.username}));
                            socket.onmessage = function(message) {
                                let parsedMessage = JSON.parse(message.data);
                                if (parsedMessage.action === 'get_markers') {
                                    angular.forEach(parsedMessage.result, function ( value) {
                                        vm.positions.push(value);
                                    });
                                }
                            }
                        }
                    );
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
        let floor = {};

        $scope.toggleLeft = menuService.toggleLeft('left');
        $scope.isOpen = false;
        $scope.header = {
            location: sessionStorage.getItem('location')
        };

        $scope.grid = {
            showGrid: true,
            gridMessage: 'On'
        };

        $scope.speedDial = {
            isOpen: false,
            selectedDirection: 'left',
            mode: 'md-scale',
            fullscreen: false,
            gridSpacing: 0
        };

        let canvas = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');

        $scope.$watch('speedDial.gridSpacing', function (newValue) {
            context.clearRect(15, 15, canvas.width, canvas.height);
            updateCanvas(canvas, context, floor.image);

            if (floor.width !== undefined) {
                //drawing vertical
                drawDashedLine(canvas, canvas.height, [5, 5], newValue, floor.width, 'vertical');
                //drawing horizontal lines
                drawDashedLine(canvas, canvas.width, [5, 5], newValue, floor.width, 'horizontal');
                //drawing images
                drawIcon(floor.anchorsResult, floor.anchorImage, floor.width, canvas);
                //draw cameras
                drawIcon(floor.camerasResult, floor.cameraImage, floor.width, canvas);
            }
        });

        $scope.$watch('grid.showGrid', function (newValue) {
            context.clearRect(15, 15, canvas.width, canvas.height);
            updateCanvas(canvas, context, floor.image);

            if (!newValue){
                //drawing images
                drawIcon(floor.anchorsResult, floor.anchorImage, floor.width, canvas);
                //draw cameras
                drawIcon(floor.camerasResult, floor.cameraImage, floor.width, canvas);
            }else {
                if (floor.width !== undefined) {
                    //drawing vertical
                    drawDashedLine(canvas, canvas.height, [5, 5], floor.spacing, floor.width, 'vertical');
                    //drawing horizontal lines
                    drawDashedLine(canvas, canvas.width, [5, 5], floor.spacing, floor.width, 'horizontal');
                    //drawing images
                    drawIcon(floor.anchorsResult, floor.anchorImage, floor.width, canvas);
                    //draw cameras
                    drawIcon(floor.camerasResult, floor.cameraImage, floor.width, canvas);
                }
            }
        });

        $scope.$watch('speedDial.fullscreen', function (newValue) {
            if (newValue) {
                openFullScreen(document.querySelector('#canvas-container'));
                $scope.speedDial.fullscreen = false;
                // $scope.$watch();
            }
        });

        socketService.getSocket().then(function (socket) {
            socket.send(encodeRequest('get_floor_info', {location: sessionStorage.getItem('location'), floor: 'floor 1'}));
            socket.send(encodeRequest('get_anchors', {floor: 'floor 1'}));
            socket.send(encodeRequest('get_cameras', {floor: 'floor 1'}));

            socket.onmessage = function (message) {
                let parsedMessage = JSON.parse(message.data);
                let result = parsedMessage.result;

                switch (parsedMessage.action) {
                    case 'get_floor_info': {
                        $scope.header.name = result[0].name;
                        floor.spacing = result[0].map_spacing;
                        floor.width = result[0].map_width;
                        $scope.speedDial.gridSpacing = result[0].map_spacing;

                        $scope.$apply();

                        let img = new Image();
                        img.src = imagePath + 'floors/' + result[0].image_map;

                        img.onload = function() {
                            floor.image = img;
                            canvas.width = this.naturalWidth;
                            canvas.height = this.naturalHeight;

                            //drawing map border
                            updateCanvas(canvas, context, img);

                            if ($scope.grid) {
                                //drawing vertical
                                drawDashedLine(canvas, canvas.height, [5, 5], floor.spacing, floor.width, 'vertical');

                                //drawing horizontal lines
                                drawDashedLine(canvas, canvas.width, [5, 5], floor.spacing, floor.width, 'horizontal')
                            }
                            //TODO load anchors
                        };
                        break;
                    }
                    case 'get_anchors':{
                        floor.anchorsResult = result;

                        let img = new Image();
                        img.src = imagePath + 'ancora-icon.png';

                        floor.anchorImage = img;

                        img.onload = function () {
                            drawIcon(result, img, floor.width, canvas);
                        };
                        break;
                    }
                    case 'get_cameras':{
                        floor.camerasResult = result;

                        let img = new Image();
                        img.src = imagePath + 'icons/camera.png';

                        floor.cameraImage = img;

                        img.onload = function () {
                          drawIcon(result, img, floor.width, canvas);
                        };

                        break;
                    }
                    case 'no_action':
                        console.log('No action sended');
                        break;
                    default:
                        console.log('No action received');
                }
                $scope.$apply();
            };

        });

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

                    socketService.getSocket().then(function (socket) {
                        socket.send(encodeRequest('get_tags', {location: sessionStorage.getItem('location')}));
                        let parsedMessage = null;

                        socket.onmessage = function (message) {
                            parsedMessage = JSON.parse(message.data);

                            if (parsedMessage.action === 'get_tags')
                                $scope.registry.tags = parsedMessage.result;
                        };

                        $scope.changeTagName = function (form) {
                            form.$submitted = true;
                            console.log('changing name');
                            console.log($scope.registry.tag);
                            if ($scope.registry.tag != null && $scope.registry.name !== ''){
                                socket.send(encodeRequest('change_tag_name', {tag: $scope.registry.tag, name: $scope.registry.name}));

                                socket.onmessage = function (message) {
                                    parsedMessage = JSON.parse(message.data);

                                    if (parsedMessage.action === 'change_tag_name'){
                                        if (parsedMessage.result === 1 || parsedMessage.result === 0) {
                                            $scope.registry.resultOk = true;
                                            $scope.registry.resultError = false;
                                            $scope.registry.fieldsEmpty = false;
                                            $scope.registry.resultClass = 'background-green';
                                            $timeout(function () {
                                                $mdDialog.hide();
                                            }, 2000)
                                        }else if (parsedMessage.result === 0) {
                                            $scope.registry.resultOk = false;
                                            $scope.registry.resultError = true;
                                            $scope.registry.fieldsEmpty = false;
                                            $scope.registry.resultClass = 'background-red';
                                        }
                                    }

                                    $scope.$apply();
                                }
                            }else {
                                $scope.registry.resultOk = false;
                                $scope.registry.resultError = false;
                                $scope.registry.fieldsEmpty = true;
                                $scope.registry.resultClass = 'background-red';
                            }
                        }
                    });

                    $scope.hide = function () {
                       $mdDialog.hide();
                    }
                }]
            })
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

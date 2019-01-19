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
            let promise = homeService.logout();

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
    canvasController.$inject = ['$scope', 'canvasService', 'socketService', 'menuService'];
    function canvasController($scope, canvasService, socketService, menuService){
        $scope.toggleLeft = menuService.toggleLeft('left');
        $scope.isOpen = false;
        $scope.floor = {};
        $scope.speedDial = {
            isOpen: false,
            selectedDirection: 'left',
            mode: 'md-scale',
            gridSpacing: 100
        };

        let canvas = document.querySelector('#canvas-id');
        let context = canvas.getContext('2d');

        $scope.$watch('speedDial.gridSpacing', function (newValue) {
            context.clearRect(15, 15, canvas.width, canvas.height);
            updateCanvas(canvas, context, $scope.floor.image);

            if ($scope.floor.width !== undefined) {
                //drawing vertical
                drawDashedLine(canvas, canvas.height, [5, 5], newValue, $scope.floor.width, 'vertical');
                //drawing horizontal lines
                drawDashedLine(canvas, canvas.width, [5, 5], newValue, $scope.floor.width, 'horizontal');
            }
        });

        socketService.getSocket().then(function (socket) {
            socket.send(encodeRequest('get_floor_info', {location: sessionStorage.getItem('location'), floor: 'floor 1'}));

            socket.onmessage = function (message) {
                let parsedMessage = JSON.parse(message.data);
                let result = parsedMessage.result[0];

                switch (parsedMessage.action) {
                    case 'get_floor_info': {
                        $scope.floor.name = result.name;
                        $scope.floor.spacing = result.map_spacing;
                        $scope.floor.width = result.map_width;
                        $scope.speedDial.gridSpacing = result.map_spacing;
                        $scope.$apply();

                        let img = new Image();
                        img.src = '../smartStudio/img/floors/' + result.image_map;

                        img.onload = function() {
                            $scope.floor.image = img;
                            canvas.width = this.naturalWidth;
                            canvas.height = this.naturalHeight;

                            //drawing map border
                            updateCanvas(canvas, context, img);

                            //drawing vertical
                            drawDashedLine(canvas, canvas.height, [5, 5], $scope.floor.spacing, $scope.floor.width, 'vertical');

                            //drawing horizontal lines
                            drawDashedLine(canvas, canvas.width, [5, 5], $scope.floor.spacing, $scope.floor.width, 'horizontal')

                            //TODO load anchors

                        };
                        break;
                    }
                    case 'no_action':
                        console.log('No action sended');
                        break;
                    default:
                        console.log('No action received');
                }
            };
        });


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

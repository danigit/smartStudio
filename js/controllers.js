(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');

    //CONTROLLERS
    main.controller('loginController', loginController);
    main.controller('homeController', homeController);
    main.controller('recoverPassController', recoverPassController);
    main.controller('mapController', mapController);

    /**
     * Function that manage the user login functionalities
     * @type {string[]}
     */
    loginController.$inject = ['$scope', 'loginService', '$location'];
    function loginController($scope, loginService, $location) {
        $scope.user = {username: '', password: ''};
        $scope.errorHandeling = {noConnection: false, wrongData: false};

        //function that makes the log in of the user
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
    homeController.$inject = ['$scope', '$websocket', 'homeService', '$location', '$timeout', '$mdSidenav'];
    function homeController($scope, $websocket, homeService, $location, $timeout, $mdSidenav) {
        let webSocket = $websocket.$new({'url': 'ws:/localhost:8080', 'protocols': []});

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

        $scope.toggleLeft = buildToggler('left');

        function buildToggler(componentId) {
            console.log('toggle');
            return function () {
                $mdSidenav(componentId).toggle();
            }
        }
    }

    /**
     * Function that manages the login map
     * @type {string[]}
     */
    mapController.$inject = ['$scope', 'NgMap', 'mapService'];
    function mapController($scope, NgMap, mapService) {
        let map = NgMap.getMap();
        $scope.markers = [];

        let promise = mapService.getMapMarkers();

        promise.then(
            function (response) {
                if (response.data.response) {
                    console.log('markers: ');
                    console.log(response.data.result);
                    $scope.markers = response.data.result;
                }
            }
        )
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

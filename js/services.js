(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('loginService', loginService);
    main.service('homeService', homeService);
    main.service('menuService', menuService);
    main.service('recoverPassService', recoverPassService);
    main.service('mapService', mapService);
    main.service('canvasService', canvasService);
    main.service('socketService', socketService);

    /**
     * Function that manage the login requests and login business logic
     * @type {string[]}
     */
    loginService.$inject = ['$http'];
    function loginService($http) {
        let service = this;

        //function that creates a new session for the user
        service.login = function (username, password) {
            return $http({
                method: 'POST',
                url: smartPath + 'php/ajax/login.php',
                params: {username: username, password: password}
            });
        };

        //Function that controls if the user has an open session
        service.isLogged = function () {
            return $http({
                method: 'GET',
                url   : smartPath + 'php/ajax/control_login.php',
            });
        };
    }

    /**
     * Function that handle home page requests and home page business logic
     * @type {string[]}
     */
    homeService.$inject = ['$http'];
    function homeService($http) {
        let service = this;

        //Function that remeve the user session
        service.logout = function () {
            return $http({
                method: 'GET',
                url   : smartPath + 'php/ajax/logout.php',
            });
        };
    }

    /**
     * Function that handles the requests for the map
     * @type {string[]}
     */
    mapService.$imject = ['$http'];
    function mapService($http){
        let service = this;

        service.getMapMarkers = function () {
            return $http({
                method: 'GET',
                url: smartPath + 'php/ajax/get_markers.php',
            })
        }
    }

    /**
     * Function that retrieve the data for the canvas page
     * @type {string[]}
     */
    canvasService.$inject = [];
    function canvasService(){
        let service = this;
    }

    /**
     * Function thai initialize a websocket chanel
     * @type {Array}
     */
    socketService.$inject = [];
    function socketService(){
        let service = this;

        service.getSocket = function(){
            return new Promise(function (resolve, reject) {
                let server = new WebSocket('ws://localhost:8090');
                server.onopen = function () {
                    resolve(server);
                };

                server.onerror = function (error) {
                    reject(error);
                };
            });
        };
    }

    /**
     * Function that handles the recover password requests
     * @type {string[]}
     */
    recoverPassService.$inject = ['$http'];
    function recoverPassService($http) {
        let service = this;

        service.recoverPassword = function (email) {
            return $http({
                method: 'POST',
                url: smartPath + 'php/ajax/recover_password.php',
                params: {email: email}
            })
        };

        service.resetPassword = function (code, username, password, repassword) {
            return $http({
                method: 'POST',
                url: smartPath + 'php/ajax/reset_password.php',
                params: {code: code, username: username, password: password, repassword: repassword}
            })
        }
    }

    /**
     * Function that handle the menu
     * @type {string[]}
     */
    menuService.$inject = ['$mdSidenav'];
    function menuService($mdSidenav) {
        let service = this;

        service.toggleLeft = function (componentId) {
            return function () {
                $mdSidenav(componentId).toggle();
            }
        }
    }
})();

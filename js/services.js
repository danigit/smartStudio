(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('loginService', loginService);
    main.service('homeService', homeService);
    main.service('recoverPassService', recoverPassService);
    main.service('mapService', mapService);

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
})();

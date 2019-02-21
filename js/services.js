(function () {
    'use strict';

    //reloading angular module
    let main = angular.module('main');


    //SERVICES
    main.service('dataService', dataService);
    main.service('loginService', loginService);
    main.service('homeService', homeService);
    main.service('menuService', menuService);
    main.service('recoverPassService', recoverPassService);
    main.service('mapService', mapService);
    main.service('canvasService', canvasService);
    main.service('socketService', socketService);

    dataService.$inject = [];
    function dataService(){
        let service = this;

        service.username = '';
        service.location = '';
        service.isAdmin = '';
        service.tags = [];
        service.anchors = [];
        service.floors = [];
        service.cameras = [];
    }

    /**
     * Function that manage the login requests and login business logic
     * @type {string[]}
     */
    loginService.$inject = [];
    function loginService() {
        let service = this;

        //function that creates a new session for the user
        // service.login = function (username, password, callback) {
        //     socketService.getSocket().then(
        //         function (socket) {
        //             socket.send(encodeRequest('login', {username: username, password: password}))
        //
        //             socket.onmessage = function (message) {
        //                 callback(message);
        //             }
        //         }
        //     )
        // };

        //Function that controls if the user has an open session
        service.isLogged = function (callback) {
        };
    }

    /**
     * Function that handle home page requests and home page business logic
     * @type {string[]}
     */
    homeService.$inject = ['socketService'];
    function homeService(socketService) {

        let service = this;

        service.getServerMarkers = function(username) {
            return socketService.getSocket('get_markers', {username: username});
        }
    }

    /**
     * Function that handles the requests for the map
     * @type {string[]}
     */
    mapService.$imject = ['$http', 'loginService', 'socketService'];
    function mapService($http, loginService, socketService){
        let service = this;

        service.getMarkers = function(callback) {
            socketService.sendMessage('get_markers', 'dani', callback);
        }
        // service.getMapMarkers = function() {
        //     loginService.isLogged().then(
        //         function (response) {
        //             if (response.data.response) {
        //                 promise.then(
        //                     function (socket) {
        //                         console.log(response.data.username);
        //                         socket.send(encodeRequest('get_markers', {username: response.data.username}));
        //                         socket.onmessage = function(response) {
        //                             if (response.action === 'get_markers') {
        //                                 return response.data;
        //                             }
        //                         }
        //                     }
        //                 );
        //             }
        //         }
        //     );
        // };
    }

    /**
     * Function that retrieve the data for the canvas page
     * @type {string[]}
     */
    canvasService.$inject = [];
    function canvasService(){
        let service = this;

        service.floor = {};
    }

    /**
     * Function thai initialize a websocket chanel
     * @type {Array}
     */
    socketService.$inject = [];
    function socketService(){
        let service = this;

        let server = new WebSocket('ws://localhost:8090');
        let isOpen = false;

        service.floor = {
            defaultFloor: 1
        };

        server.onopen = function(){
            isOpen = true;
        };

        server.onerror = function(){
        };

        service.sendRequest = function(action, data){
            return new Promise(function (resolve, reject) {

                if (isOpen) {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function (message) {
                        // console.log(message);
                        resolve(JSON.parse(message.data));
                    }
                }

                server.onopen = function () {
                    server.send(encodeRequest(action, data));
                    server.onmessage = function(message) {
                        resolve(JSON.parse(message.data));
                        isOpen = true;
                    }
                };

                server.onerror = function (error) {
                    reject(error);
                }
            })
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
                url: mainPath + 'php/ajax/recover_password.php',
                params: {email: email}
            })
        };

        service.resetPassword = function (code, username, password, repassword) {
            return $http({
                method: 'POST',
                url: mainPath + 'php/ajax/reset_password.php',
                params: {code: code, username: username, password: password, repassword: repassword}
            })
        }
    }

    /**
     * Function that handle the menu
     * @type {string[]}
     */
    menuService.$inject = ['$mdSidenav', '$http', 'socketService'];
    function menuService($mdSidenav, $http, socketService) {
        let service = this;

        service.toggleLeft = function (componentId) {
            return function () {
                $mdSidenav(componentId).toggle();
            }
        };

        //Function that remeve the user session
        service.logout = function (callback) {
            socketService.sendMessage('logout', {}, callback)
        };

        service.sendPassword = function (oldPassword, newPassword) {
            return $http({
                method: 'POST',
                url   : mainPath + 'php/ajax/change_password.php',
                params: {oldPassword: oldPassword, newPassword: newPassword}
            });
        }
    }
})();

(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ngRoute', 'ngMessages', 'ngMap', 'md.data.table']);

    //Configuring the router and the angular initial data
    main.config(function ($routeProvider) {
        $routeProvider
            .when('/', {
                resolve: {
                    check: function ($location, $timeout, socketService) {
                        // if the user is logged the I redirect to the home
                        $timeout(function () {
                            socketService.getSocket().then(
                                function (socket) {
                                    socket.send(encodeRequest('is_logged', {}));

                                    socket.onmessage = function (message) {
                                        let mess = JSON.parse(message.data);
                                        if (mess.result.id !== undefined) {
                                            $location.path('/home');
                                        }
                                    }
                                }
                            )
                        }, 0)

                    },
                },
                templateUrl: mainPath + 'components/login.html',
                controller: 'loginController'})
            .when('/home',{
                resolve: {
                    check: function ($location, $timeout, socketService) {
                        //if the user is not logged then I redirect to the login page
                        $timeout(function () {
                            socketService.getSocket().then(
                                function (socket) {
                                    socket.send(encodeRequest('is_logged', {}));
                                    socket.onmessage = function (message) {
                                        let mess = JSON.parse(message.data);
                                        if (mess.result === 'not_logged')
                                            $location.path('/');
                                    }
                                }
                            )
                        }, 0)
                    },
                },
                templateUrl: mainPath + 'components/home.html',
                controller: 'homeController'})
            .when('/canvas',{
                resolve: {
                    check: function ($location, $timeout, socketService) {
                        // if the user is not logged then I redirect to the login page
                        $timeout(function () {
                            socketService.getSocket().then(
                                function (socket) {
                                    socket.send(encodeRequest('is_logged', {}));
                                    socket.onmessage = function (message) {
                                        let mess = JSON.parse(message.data);
                                        if (mess.result === 'not_logged')
                                            $location.path('/');
                                    }
                                }
                            )
                        }, 0)
                    },
                },
                templateUrl: mainPath + 'components/canvas.html',
                controller: 'canvasController'})
            .when('/recover-password',{
                templateUrl: mainPath + 'components/recover-password.html',
                controller: 'recoverPassController'})
            .when('/recover-password-code',{
                templateUrl: mainPath + 'components/recover-password-code.html',
                controller: 'recoverPassController'
            })
    });
})();
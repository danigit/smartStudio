(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ui.router', 'ngMessages', 'ngMap', 'md.data.table', 'chart.js']);

    //Configuring the router and the angular initial data
    main.config(RoutesConfig);

    RoutesConfig.$inject = ['$stateProvider', '$urlRouterProvider', '$mdDateLocaleProvider'];
    function RoutesConfig($stateProvider, $urlRouterProvider, $mdDateLocaleProvider) {

        $urlRouterProvider.otherwise('/login');

        $stateProvider
            //changing to the login page
            .state('login', {
                url: '/login',
                templateUrl: '../SMARTSTUDIO/components/login.html',
                controller: 'loginController as loginCtr',
                resolve:{
                    goToHomeIfLoggedIn: ['socketService', '$state', function (socketService, $state) {
                        socketService.sendRequest('get_user', {})
                            .then(function (response) {
                                if (response.result !== 'no_user')
                                    $state.go('home');
                            });
                    }]
                }
            })

            //changing to the recover password page
            .state('recover-password', {
                url: '/recover-password',
                templateUrl: '../SMARTSTUDIO/components/recover-password.html',
                controller: 'recoverPassController as recoverPassCtr',
                // resolve:{
                //     goToHomeIfLoggedIn: ['socketService', '$state', function (socketService, $state) {
                //         socketService.sendRequest('get_user', {})
                //             .then(function (response) {
                //                 if (response.result !== 'no_user')
                //                     $state.go('home');
                //             });
                //     }]
                // }
            })

            //changing to the recover password code page
            .state('recover-password-code', {
                url: '/recover-password-code',
                templateUrl: '../SMARTSTUDIO/components/recover-password-code.html',
                controller: 'recoverPassController as recoverPassCtr',
                // resolve:{
                //     goToHomeIfLoggedIn: ['socketService', '$state', function (socketService, $state) {
                //         socketService.sendRequest('get_user', {})
                //             .then(function (response) {
                //                 if (response.result !== 'no_user')
                //                     $state.go('home');
                //             });
                //     }]
                // }
            })

            //changing to the home page
            .state('home', {
                url: '/home',
                templateUrl: '../SMARTSTUDIO/components/home.html',
                controller: 'homeController as homeCtrl',
                resolve: {
                    homeData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService,  $state, $q) {
                        let promise = $q.defer();
                        let result = {};
                        socketService.sendRequest('get_user', {})
                            .then(
                            function (response) {
                                if (response.result.session_name !== undefined) {
                                    dataService.username = response.result.session_name;
                                    response.isAdmin = response.result.is_admin;

                                    return socketService.sendRequest('get_markers', {username: response.result.session_name})
                                }else {
                                    $state.go('login');
                                }
                            })
                            .then(
                            function (response) {
                                result.markers = response.result;

                                return socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                            })
                            .then(function (response) {
                                dataService.tags = response.result;
                                result.tags = response.result;

                                dataService.alarmsSounds = [];
                                promise.resolve(result);
                            });

                        return promise.promise;
                    }],
                }
            })

            //changing to the outdoor-location page
            .state('outdoor-location', {
                url: '/outdoor-location',
                templateUrl: '../SMARTSTUDIO/components/outdoor-location.html',
                controller: 'outdoorController as outdoorCtrl',
                resolve: {
                    outdoorData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService,  $state, $q) {
                        let promise = $q.defer();
                        let result = {};
                        socketService.sendRequest('get_user', {})
                            .then(
                            function (response) {
                                if (response.result.session_name !== undefined) {

                                    dataService.username = response.result.session_name;

                                    result.username = response.result.session_name;
                                    result.isAdmin = response.result.is_admin;
                                    return socketService.sendRequest('get_tags_by_user', {user: dataService.username})
                                }else {
                                    $state.go('login');
                                }
                            })
                            .then(function (response) {

                                dataService.tags = response.result;
                                result.tags = response.result;

                                promise.resolve(result);
                            });

                        return promise.promise;
                    }],
                }
            })

            //changing to the canvas page
            .state('canvas', {
                url: '/canvas',
                templateUrl: '../SMARTSTUDIO/components/canvas.html',
                controller: 'canvasController as canvasCtrl',
                resolve: {
                    canvasData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result = {};

                        socketService.sendRequest('get_user', {})
                            .then(function (response) {
                                if (response.result.session_name !== undefined) {
                                    dataService.username = response.result.session_name;
                                    dataService.isAdmin  = response.result.is_admin;

                                    return socketService.sendRequest('get_location_info', {})
                                }else{
                                    $state.go('login');
                                }
                            })
                            .then(function (response) {
                                if (response.result !== 'location_not_found') {
                                    dataService.location = response.result[0].name;

                                    return socketService.sendRequest('get_floors_by_location', {location: response.result[0].name});
                                }
                            })
                            .then(function (response) {
                                dataService.floors = response.result;

                                return socketService.sendRequest('get_tags_by_user', {user: dataService.username});
                            })
                            .then(function (response) {
                                dataService.tags = response.result;

                                return socketService.sendRequest('get_floors_by_user', {user: dataService.username});
                            })
                            .then(function (response) {
                                dataService.userFloors = response.result;

                                dataService.alarmsSounds = [];
                                promise.resolve(result);
                            });
                        return promise.promise;
                    }]
                }
            }
        );

        //formatting the data in the european format
        $mdDateLocaleProvider.formatDate = function(date) {

            let day = date.getDate();
            let monthIndex = date.getMonth();
            let year = date.getFullYear();

            return day + '/' + (monthIndex + 1) + '/' + year;

        };
    }
})();
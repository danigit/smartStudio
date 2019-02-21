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
            .state('login', {
                url: '/login',
                templateUrl: '../components/login.html',
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

            .state('recover-password', {
                url: '/recover-password',
                templateUrl: '../components/recover-password.html',
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

            .state('recover-password-code', {
                url: '/recover-password-code',
                templateUrl: '../components/recover-password-code.html',
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


            .state('home', {
                url: '/home',
                templateUrl: '../components/home.html',
                controller: 'homeController as homeCtrl',
                resolve: {
                    homeData: ['homeService', 'socketService', 'dataService', '$state', '$q', function (homeService, socketService, dataService,  $state, $q) {
                        let promise = $q.defer();
                        let result = {};
                        socketService.sendRequest('get_user', {})
                            .then(
                            function (response) {
                                if (response.result.session_name !== undefined) {

                                    dataService.username = response.result.session_name;

                                    response.username = response.result.session_name;
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

                                promise.resolve(result);
                            });

                        return promise.promise;
                    }],
                }
            })

            .state('outdoor-location', {
                url: '/outdoor-location',
                templateUrl: '../components/outdoor-location.html',
                controller: 'outdoorController as outdoorCtrl',
                resolve: {
                    outdoorData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService,  $state, $q) {
                        let promise = $q.defer();
                        let result = {};
                        socketService.sendRequest('get_user', {})
                            .then(
                            function (response) {
                                if (response.result.session_name !== undefined) {

                                    dataService.username = mess.result.session_name;

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

            .state('canvas', {
                url: '/canvas',
                templateUrl: '../components/canvas.html',
                controller: 'canvasController as canvasCtrl',
                resolve: {
                    canvasData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result = {};

                        socketService.sendRequest('get_user', {})
                            .then(function (response) {
                                dataService.username = response.result.session_name;
                                dataService.isAdmin = response.result.is_admin;

                                return socketService.sendRequest('get_location_info', {})
                            })
                            .then(function (response) {
                                if (response.result !== 'location_not_found') {
                                    dataService.location = response.result[0].name;

                                    return socketService.sendRequest('get_floors', {location: response.result[0].name});
                                }
                            })
                            .then(function (response) {
                                dataService.floors = response.result;

                                result.location = dataService.location;
                                result.floors = dataService.floors;
                                return socketService.sendRequest('get_tags_by_user', {user: dataService.username});
                            })
                            .then(function (response) {

                                dataService.tags = response.result;

                                promise.resolve(result);
                            });

                        return promise.promise;
                    }]
                }
            }
        );

        $mdDateLocaleProvider.formatDate = function(date) {

            let day = date.getDate();
            let monthIndex = date.getMonth();
            let year = date.getFullYear();

            return day + '/' + (monthIndex + 1) + '/' + year;

        };
    }
})();
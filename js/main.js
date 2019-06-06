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
                url        : '/login',
                templateUrl: componentsPath + 'login.html',
                controller : 'loginController as loginCtr',
                resolve    : {
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
                url        : '/recover-password',
                templateUrl: componentsPath + 'recover-password.html',
                controller : 'recoverPassController as recoverPassCtr',
            })

            //changing to the recover password code page
            .state('recover-password-code', {
                url        : '/recover-password-code',
                templateUrl: componentsPath + 'recover-password-code.html',
                controller : 'recoverPassController as recoverPassCtr',
            })

            //changing to the home page
            .state('home', {
                url        : '/home',
                templateUrl: componentsPath + 'home.html',
                controller : 'homeController as homeCtrl',
                resolve    : {
                    homeData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result  = {};
                        socketService.sendRequest('get_user', {})
                            .then((response) => {
                                if (response.result !== 'no_user') {
                                    dataService.user = response.result[0];
                                    if (response.result[0].role === 1) {
                                        dataService.isAdmin = response.result[0].role;
                                        dataService.isUserManager = 0;
                                        result.password_changed = response.result[0].password_changed;
                                    }else if (response.result[0].role === 2){
                                        dataService.isAdmin = 0;
                                        dataService.isUserManager      = response.result[0].role;
                                        result.password_changed = response.result[0].password_changed;
                                    }else if (response.result[0].role === 0){
                                        dataService.isAdmin = 0;
                                        dataService.isUserManager = 0;
                                        result.password_changed = response.result[0].password_changed;
                                    }
                                    return socketService.sendRequest('get_markers', {username: response.result[0].username})
                                } else {
                                    $state.go('login');
                                }
                            })
                            .then((response) => {
                                result.markers = response.result;
                                if (response.result.length === 1 && response.result[0].one_location === 1){
                                    socketService.sendRequest('save_location', {location: response.result[0].name})
                                        .then((response) => {
                                            if (response.result === 'location_saved') {
                                                return socketService.sendRequest('get_location_info', {})
                                            }
                                        })
                                        .then((response) => {
                                            dataService.defaultFloorName  = '';
                                            dataService.locationFromClick = '';
                                            if (response.result.is_inside)
                                                $state.go('canvas')
                                        })
                                        .catch((error) => {
                                            console.log('markerAddListener error => ', error);
                                        });
                                }else {
                                    return socketService.sendRequest('get_all_tags', {});
                                }
                            })
                            .then((response) => {
                                if (response !== null && response !== undefined) {
                                    dataService.allTags = response.result;
                                    promise.resolve(result);
                                }
                            })
                            .catch((error) => {
                                console.log('homeState error => ', error);
                            });

                        return promise.promise;
                    }],
                }
            })

            //changing to the outdoor-location page
            .state('outdoor-location', {
                url        : '/outdoor-location',
                templateUrl: componentsPath + 'outdoor-location.html',
                controller : 'outdoorController as outdoorCtrl',
                resolve    : {
                    outdoorData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result  = {};
                        socketService.sendRequest('get_location_info', {})
                            .then((response) => {
                                if (response.result !== 'location_not_found') {
                                    dataService.location = response.result;
                                    if (response.result.is_inside)
                                        $state.go('home')
                                } else {
                                    $state.go('home');
                                }

                                return socketService.sendRequest('get_user', {})
                            })
                            .then((response) => {
                                if (response.result[0].username !== undefined) {

                                    dataService.user = response.result[0];

                                    if (response.result[0].role === 1){
                                        dataService.isAdmin = response.result[0].role;
                                        dataService.isUserManager = response.result[0].role;
                                    } else if (response.result[0].role === 2){
                                        dataService.isAdmin = 0;
                                        dataService.isUserManager = response.result[0].role;
                                    } else if (response.result[0].role === 0){
                                        dataService.isAdmin = 0;
                                        dataService.isUserManager = 0;
                                    }

                                    return socketService.sendRequest('get_tags_by_user', {user: dataService.user.username})
                                } else {
                                    $state.go('login');
                                }
                            })
                            .then((response) => {

                                dataService.userTags = response.result;
                                return socketService.sendRequest('get_all_tags', {});
                            })
                            .then((response) => {
                                if (response !== null && response !== undefined) {
                                    dataService.allTags = response.result;
                                    dataService.alarmsSounds = [];
                                    promise.resolve(result);
                                }
                            })
                            .catch((error) => {
                                console.log('outdoorLocationState => ', error);
                            });

                        return promise.promise;
                    }],
                }
            })

            //changing to the canvas page
            .state('canvas', {
                url        : '/canvas',
                templateUrl: componentsPath + 'canvas.html',
                controller : 'canvasController as canvasCtrl',
                resolve    : {
                    canvasData: ['socketService', 'dataService', '$state', '$q', function (socketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result  = {};

                        socketService.sendRequest('get_user', {})
                            .then((response) => {
                                if (response.result[0].username !== undefined) {
                                    dataService.user = response.result[0];
                                    if (response.result[0].role === 1){
                                        dataService.isAdmin  = response.result[0].role;
                                        dataService.isUserManager = 0;
                                    } else if (response.result[0].role === 2){
                                        dataService.isAdmin  = 0;
                                        dataService.isUserManager = response.result[0].role;
                                    } else if (response.result[0].role === 0){
                                        dataService.isAdmin  = 0;
                                        dataService.isUserManager = 0;
                                    }

                                    return socketService.sendRequest('get_location_info', {})
                                } else {
                                    $state.go('login');
                                }
                            })
                            .then((response) => {
                                if (response.result !== 'location_not_found') {
                                    if (response.result.is_inside) {
                                        dataService.location = response.result
                                        dataService.isLocationInside = response.result.is_inside;
                                    }else
                                        $state.go('home');

                                    return socketService.sendRequest('get_floors_by_location', {location: response.result.name});
                                }
                            })
                            .then((response) => {
                                dataService.floors = response.result;

                                return socketService.sendRequest('get_tags_by_user', {user: dataService.user.username});
                            })
                            .then((response) => {
                                dataService.userTags = response.result;

                                console.log(dataService.user)
                                return socketService.sendRequest('get_floors_by_user', {user: dataService.user.username});
                            })
                            .then((response) => {
                                dataService.userFloors = response.result;

                                dataService.alarmsSounds = [];
                                return socketService.sendRequest('get_all_tags', {});
                            })
                            .then((response) => {
                                dataService.allTags = response.result;
                                return socketService.sendRequest('get_alpha');
                            })
                            .then((response) => {
                                result.alpha = response.result.alpha;
                                console.log(dataService.location);
                                promise.resolve(result);
                            })
                            .catch((error) => {
                                console.log('canvasState error => ', error);
                            });
                        return promise.promise;
                    }]
                }
            });

        //formatting the data in the european format
        $mdDateLocaleProvider.formatDate = function (date) {

            let day        = date.getDate();
            let monthIndex = date.getMonth();
            let year       = date.getFullYear();

            return day + '/' + (monthIndex + 1) + '/' + year;

        };
    }
})();
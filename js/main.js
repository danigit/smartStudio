(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ui.router', 'ngMessages', 'ngMap', 'md.data.table', 'chart.js', 'ngFileSaver']);

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
                    goToHomeIfLoggedIn: ['$state', 'newSocketService', 'dataService', function ($state, newSocketService, dataService) {
                        newSocketService.getData('get_user', {username: sessionStorage.user}, (response) => {
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
                    homeData: ['newSocketService', 'dataService', '$state', '$q', '$interval', function (newSocketService, dataService, $state, $q, $interval) {
                        let promise = $q.defer();
                        let result  = {};
                        setTimeout(function () {
                            newSocketService.getData('get_user', {username: sessionStorage.user}, (response) => {
                                if (response.result !== 'no_user') {
                                    dataService.user = response.result[0];
                                    if (response.result[0].role === 1) {
                                        dataService.isAdmin       = response.result[0].role;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker     = 0;
                                        result.password_changed = response.result[0].password_changed;
                                    }else if (response.result[0].role === 2){
                                        dataService.isAdmin = 0;
                                        dataService.isTracker = 0;
                                        dataService.isUserManager      = response.result[0].role;
                                        result.password_changed = response.result[0].password_changed;
                                    }else if (response.result[0].role === 0){
                                        dataService.isAdmin       = 0;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker     = 0;
                                        result.password_changed   = response.result[0].password_changed;
                                    } else if (response.result[0].role === 3) {
                                        dataService.isAdmin       = 0;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker     = 1;
                                        result.password_changed   = response.result[0].password_changed;
                                    }

                                    let askLocations = $interval(() => {
                                        newSocketService.getData('get_markers', {username: response.result[0].username}, (markers) => {
                                            if (dataService.isResponseCorrect(markers.action, 'get_markers')) {
                                                result.markers = markers.result;
                                                if (response.result.length === 1 && response.result[0].one_location === 1) {
                                                    newSocketService.getData('save_location', {location: markers.result[0].name}, (locationSaved) => {
                                                        if (locationSaved.result === 'location_saved') {
                                                            newSocketService.getData('get_location_info', {}, (locationInfo) => {
                                                                dataService.defaultFloorName  = '';
                                                                dataService.locationFromClick = '';
                                                                if (locationInfo.result.is_inside)
                                                                    $state.go('canvas');
                                                                console.log(result);
                                                                promise.resolve(result);
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    newSocketService.getData('get_all_tags', {}, (tags) => {
                                                        if (tags !== null && tags !== undefined) {
                                                            dataService.allTags = tags.result;
                                                            promise.resolve(result);
                                                        }
                                                    })
                                                }
                                                $interval.cancel(askLocations);
                                            }
                                        })
                                    }, 1000)

                                } else {
                                    $state.go('login');
                                }
                            });

                        }, 500);
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
                    outdoorData: ['newSocketService', 'dataService', '$state', '$q', function (newSocketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result  = {};
                        setTimeout(function () {
                            newSocketService.getData('get_location_info', {}, (response) => {
                                if (response.result !== 'location_not_found') {
                                    dataService.location = response.result;
                                    if (response.result.is_inside)
                                        $state.go('home')
                                } else {
                                    $state.go('home');
                                }
                                newSocketService.getData('get_user', {username: sessionStorage.user}, (user) => {
                                    if (user.result[0].username !== undefined) {

                                        dataService.user = user.result[0];

                                        if (user.result[0].role === 1) {
                                            dataService.isAdmin       = user.result[0].role;
                                            dataService.isUserManager = 0;
                                            dataService.isTracker = 0;
                                        } else if (user.result[0].role === 2) {
                                            dataService.isAdmin       = 0;
                                            dataService.isUserManager = user.result[0].role;
                                            dataService.isTracker = 0;
                                        } else if (user.result[0].role === 0) {
                                            dataService.isAdmin       = 0;
                                            dataService.isUserManager = 0;
                                            dataService.isTracker = 0;
                                        } else if (user.result[0].role === 3){
                                            dataService.isAdmin = 0;
                                            dataService.isUserManager = 0;
                                            dataService.isTracker = 1;
                                        }

                                        newSocketService.getData('get_tag_by_user', {user: dataService.user.username}, (userTags) => {
                                            dataService.userTags = userTags.result;
                                            newSocketService.getData('get_all_tags', {}, (allTags) => {
                                                if (allTags !== null && allTags !== undefined) {
                                                    dataService.allTags      = allTags.result;
                                                    dataService.alarmsSounds = [];
                                                    promise.resolve(result);
                                                }
                                            });
                                        })
                                    } else {
                                        $state.go('login');
                                    }
                                });
                            });
                        }, 500);
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
                    canvasData: ['newSocketService', 'dataService', '$state', '$q', function (newSocketService, dataService, $state, $q) {
                        let promise = $q.defer();
                        let result  = {};

                        setTimeout(function () {
                            newSocketService.getData('get_user', {username: sessionStorage.user}, (response) => {
                                if (response.result[0].username !== undefined) {
                                    dataService.user = response.result[0];
                                    if (response.result[0].role === 1) {
                                        dataService.isAdmin       = response.result[0].role;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker = 0;
                                    } else if (response.result[0].role === 2) {
                                        dataService.isAdmin       = 0;
                                        dataService.isUserManager = response.result[0].role;
                                        dataService.isTracker = 0;
                                    } else if (response.result[0].role === 0) {
                                        dataService.isAdmin       = 0;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker = 0;
                                    } else if (response.result[0].role === 3){
                                        dataService.isAdmin = 0;
                                        dataService.isUserManager = 0;
                                        dataService.isTracker = 1;
                                    }

                                    newSocketService.getData('get_location_info', {}, (locationInfo) => {
                                        if (locationInfo.result !== 'location_not_found') {
                                            if (locationInfo.result.is_inside) {
                                                dataService.location         = locationInfo.result;
                                                dataService.isLocationInside = locationInfo.result.is_inside;
                                            } else
                                                $state.go('home');

                                            newSocketService.getData('get_floors_by_location', {location: locationInfo.result.name}, (floors) => {
                                                dataService.floors = floors.result;

                                                newSocketService.getData('get_tags_by_user', {user: dataService.user.username}, (userTags) => {
                                                    dataService.userTags = userTags.result;

                                                    newSocketService.getData('get_floors_by_user', {user: dataService.user.username}, (userFloors) => {
                                                        dataService.userFloors = userFloors.result;

                                                        dataService.alarmsSounds = [];

                                                        newSocketService.getData('get_all_tags', {}, (allTags) => {
                                                            dataService.allTags = allTags.result;

                                                            newSocketService.getData('get_alpha', {}, (alpha) => {
                                                                result.alpha = alpha.result.alpha;
                                                                promise.resolve(result);
                                                            })
                                                        })
                                                    })
                                                })
                                            })
                                        }
                                    })
                                } else {
                                    $state.go('login');
                                }
                            });
                        }, 500);
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
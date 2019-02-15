(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ui.router', 'ngMessages', 'ngMap', 'md.data.table']);

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
                        socketService.getSocket('get_user', {})
                            .then(function (response) {
                                let message = JSON.parse(response.data);
                                if (message.result !== 'no_user')
                                    $state.go('home');
                            });
                    }]
                }
            })

            .state('home', {
                url: '/home',
                templateUrl: '../components/home',
                controller: 'homeController as homeCtrl',
                resolve: {
                    homeData: ['homeService', 'socketService', 'dataService', '$state', '$q', function (homeService, socketService, dataService,  $state, $q) {
                        let promise = $q.defer();

                        socketService.getSocket('get_user', {}).then(
                            function (response) {
                                let mess = JSON.parse(response.data);
                                if (mess.result.session_name !== undefined) {
                                    dataService.username = mess.result.session_name;
                                    socketService.getSocket('get_markers', {username: mess.result.session_name}).then(
                                        function (message) {
                                            let result = {
                                                markers: JSON.parse(message.data),
                                                isAdmin: mess.result.is_admin
                                            };

                                            socketService.getSocket('get_tags_by_user', {user: dataService.username})
                                                .then(function (response) {
                                                    let message = JSON.parse(response.data);
                                                    dataService.tags = message.result;
                                                    promise.resolve(result);
                                                }
                                            );
                                        }
                                    )
                                }else {
                                    $state.go('login');
                                }
                            }
                        );

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
                        socketService.getSocket('get_user', {})
                            .then(function (response) {
                                let message = JSON.parse(response.data);
                                dataService.username = message.result.session_name;

                                return socketService.getSocket('get_location_info', {})
                            })
                            .then(function (response) {
                                let message = JSON.parse(response.data);
                                if (message.result !== 'location_not_found') {
                                    dataService.location = message.result;
                                    return socketService.getSocket('get_floors', {location: message.result.name});
                                }
                            })
                            .then(function (response) {
                                let message = JSON.parse(response.data);

                                dataService.floors = message.result;
                                promise.resolve({location: dataService.location, floors: message.result})
                            }
                        );

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
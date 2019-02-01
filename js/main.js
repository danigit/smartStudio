(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ui.router', 'ngMessages', 'ngMap', 'md.data.table']);

    //Configuring the router and the angular initial data
    main.config(RoutesConfig);

    RoutesConfig.$inject = ['$stateProvider', '$urlRouterProvider'];
    function RoutesConfig($stateProvider, $urlRouterProvider) {

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
                    homeData: ['homeService', 'socketService', '$state', '$q', function (homeService, socketService, $state, $q) {
                        let promise = $q.defer();

                        socketService.getSocket('get_user', {}).then(
                            function (response) {
                                let mess = JSON.parse(response.data);
                                if (mess.result.session_name !== undefined) {
                                    socketService.getSocket('get_markers', {username: mess.result.session_name}).then(
                                        function (message) {
                                            let result = {
                                                markers: JSON.parse(message.data),
                                                isAdmin: mess.result.is_admin
                                            };
                                            promise.resolve(result);
                                        }
                                    )
                                }else {
                                    $state.go('login');
                                }
                            }
                        );

                        return promise.promise;
                    }]
                }
            })

            .state('canvas', {
                url: '/canvas',
                templateUrl: '../components/canvas.html',
                controller: 'mapController as mapCtrl'
            })
    }
})();
(function () {
    'use strict';

    //loading the angular framework and the dependencies
    let main = angular.module('main', ['ngMaterial', 'ngRoute', 'ngMessages', 'ngWebsocket', 'ngMap']);

    //Configuring the router and the angular initial data
    main.config(function ($routeProvider) {
        $routeProvider
            .when('/', {
                resolve: {
                    check: function ($location, loginService) {
                        //if the user is logged the I redirect to the home
                        loginService.isLogged().then(
                            function (response) {
                                if (response.data.response){
                                    console.log(response.data);
                                    $location.path('/home');
                                }
                            }
                        );
                    },
                },
                templateUrl: mainPath + 'components/login.html',
                controller: 'loginController'})
            .when('/home',{
                resolve: {
                    check: function ($location, loginService) {
                        //if the user is not logged then I redirect to the login page
                        loginService.isLogged().then(
                            function (response) {
                                if (!response.data.response){
                                    console.log(response.data);
                                    $location.path('/');
                                }
                            }
                        );
                    },
                },
                templateUrl: mainPath + 'components/home.html',
                controller: 'mapController'})
            .when('/recover-password',{
                templateUrl: mainPath + 'components/recover-password.html',
                controller: 'recoverPassController'})
            .when('/recover-password-code',{
                templateUrl: mainPath + 'components/recover-password-code.html',
                controller: 'recoverPassController'
            })
    });
})();
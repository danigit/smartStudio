(function () {
    'use strict';

    let main = angular.module('main', ['ngMaterial', 'ngRoute', 'ngMessages']);

    main.config(function ($routeProvider) {
        $routeProvider
            .when('/', {
                resolve: {
                    // check: function ($location, LoginService) {
                    //     LoginService.isLogged().then(
                    //         function (response) {
                    //             if (response.data.response){
                    //                 $location.path('/home');
                    //             }
                    //         }
                    //     );
                    // },
                },
                templateUrl: smartPath + '/components/login.html',
                controller: 'loginController'
            })
    });

    //CONTROLLERS
    main.controller('loginController', loginController);


    //SERVICES
    main.service('loginService', loginService);
})();
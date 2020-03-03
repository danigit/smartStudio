(function () {
    'use strict';

    //reloading angular module
    angular.module('main').controller('loginController', loginController);

    /**
     * Function that manage the user login with email and password
     * @type {string[]}
     */
    loginController.$inject = ['$scope', '$state', '$timeout', 'newSocketService', 'dataService'];

    function loginController($scope, $state, $timeout, newSocketService, dataService) {
        $scope.user           = {username: '', password: ''};
        $scope.showPartner = SHOW_PARTNER_LOGO;

        // handling the login error messages
        $scope.errorHandeling = {noConnection: false, wrongData: false, socketClosed: newSocketService.socketClosed};

        // function that makes the log in of the user
        $scope.login = (form) => {
            form.$submitted = 'true';

            if (socketOpened === false){
                $scope.errorHandeling.socketClosed = true;
            }else if ($scope.user.username !== '' && $scope.user.password !== '') {
                // control if socket is connected
                if (socketServer.readyState === 1) {
                    // changing the label of the login button and disabling it
                    loginInProgressButton();

                    newSocketService.getData('login', {
                        username: $scope.user.username,
                        password: $scope.user.password
                    }, (response) => {
                        // showing errors on login
                        if (response === 'error') {
                            $scope.errorHandeling.wrongData    = false;
                            $scope.errorHandeling.noConnection = true;
                        }
                        // if the login is ok I save the username in local and redirect to home
                        else if (response.result.id !== undefined) {
                            dataService.user.username = $scope.user.username;
                            sessionStorage.user       = cesarShift($scope.user.username, CEZAR_KEY);
                            $state.go('home');
                        }
                        // showing errors on login
                        else {
                            $scope.errorHandeling.noConnection = false;
                            $scope.errorHandeling.wrongData    = true;
                        }
                        $scope.$apply();
                    });
                }
            }
        };

        //change the page to the recover password page
        $scope.recoverPassword = () => {
            $state.go('recover-password');
        }
    }
})();

/**
 * Function that chages the write on the login button and disables it
 */
let loginInProgressButton = () => {
    document.querySelector('#loginButton').innerHTML = lang.entering;
    document.querySelector('#loginButton').style.color = LOGING_IN_COLOR;
    document.querySelector('#loginButton').disabled = true;
};
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
        $scope.debug = DEBUG;

        // handling the login error messages
        $scope.errorHandeling = {wrongData: false, socketClosed: newSocketService.socketClosed};

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
                        if (response.result === 'ERROR_ON_LOGIN') {
                            $scope.errorHandeling.wrongData    = true;
                            resetLoginButton();
                        }
                        // if the login is ok I save the username in local and redirect to home
                        else if (response.result.id !== undefined) {
                            dataService.user.username = $scope.user.username;
                            sessionStorage.user       = CryptoJS.AES.encrypt($scope.user.username, 'SmartStudio');
                            document.cookie           = 'username_smart = ' + $scope.user.username;
                            document.cookie           = 'password_smart = ' + CryptoJS.AES.encrypt($scope.user.password, 'SmartStudio');
                            $state.go('home');
                        }
                        // showing error on login
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

        $scope.closeSocket= () =>{
            console.log('Closing the socket...')
            socketServer.onclose = () => {}
            socketServer.close();
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

/**
 * Function that reset the write on the login button and enables it
 */
let resetLoginButton = () => {
    document.querySelector('#loginButton').innerHTML = lang.login;
    document.querySelector('#loginButton').style.color = '#000000';
    document.querySelector('#loginButton').disabled = false;
};
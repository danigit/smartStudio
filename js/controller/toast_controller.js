(function () {
    'use strict';

    angular.module('main').controller('toastController', toastController);

    /**
     * Function that manges the home page including:
     * * locations on the map
     * * general alarms
     * @type {string[]}
     */
    toastController.$inject = ['$mdToast', '$mdDialog', '$document', '$scope', 'message'];

    function toastController($mdToast, $mdDialog, $document, $scope) {
        let toastCtrl = this;
        $scope.message = toastCtrl.message;
        $scope.background = toastCtrl.background;
        $scope.color = toastCtrl.color;
        angular.element(document).ready(() => {
            document.getElementById('toast').firstChild.classList.add(toastCtrl.background);
        })
    }
})();
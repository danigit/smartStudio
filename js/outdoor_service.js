(function () {
    'use strict';

    //reloading angular module and creating the home service
    angular.module('main').service('outdoorService', outdoorService);

    outdoorService.$inject = ['$mdDialog', '$interval', '$state', 'newSocketService', 'dataService'];

    function outdoorService($mdDialog, $interval, $state, newSocketService, dataService) {
        let outdoor_service = this;

        /**
         * Function that control if the marker passed as parameter has to be displayed on the map
         * @param marker
         * @param tags
         * @returns {boolean}
         */
        outdoor_service.isMarkerStillOnMap = (marker, tags) => {
            return tags.some(ot => marker.getPosition().lat() === ot.gps_north_degree && marker.getPosition().lng() === ot.gps_east_degree)
        };

    }
})();
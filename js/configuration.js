/***************************************************************
 * SOCKET COFIGURATIONS
 ***************************************************************/
let socketServer               = new WebSocket('ws://localhost:8090');
let socketOpened = false;
let groupTagDistance = 400.5;
const DEBUG = true;

socketServer.onopen = function () {
    socketOpened = true;
};

/***************************************************************
 * DIRECTORIES PATHS
 ***************************************************************/
const mainPath = '';
const componentsPath = 'components/';
const imagePath = 'img/';
const iconsPath = 'img/icons/';
const markersIconPath = 'img/icons/markers/';
const tagsIconPath = 'img/icons/tags/';
const audioPath = 'resources/audio/';
const floorPath = 'img/floors/';

/***************************************************************
 * CANVAS DEFAULT VARIABLES
 ***************************************************************/
const canvasBorderSpace = 25;
const canvasGridPattern = [5, 5];

/***************************************************************
 * MAPS COFIGURATIONS
 ***************************************************************/
const mapZoom = 3;
const outdoorLocationZoom = 17;
const mapType = 'TERAIN';
const mapCenter = [41.87194, 12.56738];

let mapConfiguration = [{
    featureType: "poi",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}, {
    featureType: "water",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}, {
    featureType: "road",
    elementType: "labels",
    stylers    : [
        {visibility: "off"}
    ]
}];

/***************************************************************
* HOME COFIGURATIONS
***************************************************************/

const HOME_ALARM_UPDATE_TIME = 1000;
const TAGS_ALARMS_WINDOW_UPDATE_TIME = 1000;
const ALARMS_WINDOW_UPDATE_TIME = 1000;
const ANCHORS_ALARMS_WINDOW_UPDATE_TIME = 1000;
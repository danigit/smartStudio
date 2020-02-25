/***************************************************************
 * SOCKET COFIGURATIONS
 ***************************************************************/
const socketPath = 'localhost:8090';
const MESSAGE_WAITING_TIME = 30000;
let socketServer               = new WebSocket('ws://' + socketPath);
let socketOpened = false;
let groupTagDistance = 0.5;

socketServer.onopen = function () {
    console.log('Socket opened')
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
const TIME_REST = 30;

/***************************************************************
 * MAPS COFIGURATIONS
 ***************************************************************/
const mapZoom = 10;
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

/*************************************************************
 * GENERIC CONFIGURATIONS
 *************************************************************/

const showPartnerLogo = true;
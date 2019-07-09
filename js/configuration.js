/***************************************************************
 * DIRECTORIES PATHS
 ***************************************************************/
const mainPath = '';
const componentsPath = 'components/';
const imagePath = 'img/';
const iconsPath = 'img/icons/';
const menuIconsPath = 'img/icons/menu/';
const markersIconPath = 'img/icons/markers/';
const tagsIconPath = 'img/icons/tags/';
const resourcePath = 'resources/';
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
const mapZoom = 10;
const outdoorLocationZoom = 15;
const mapType = 'TERAIN';
const mapCenter = [41.87194, 12.56738];

let requestId = 0;

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

let socketServer               = new WebSocket('ws://localhost:8090');
let socketOpened = false;
socketServer.addEventListener('open', function () {
    socketOpened = true;
});
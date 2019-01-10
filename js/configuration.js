
let smartPath = '../smartStudio/';
let mainPath = '../smartStudio/';

function initMap() {
    let map = null;
    let latlng = new google.maps.LatLng(41.87194, 12.56738);
    let mapProp= {
        scrollwheel: true,
        center: latlng,
        mapTypeId: 'terrain',
        draggable: false,
        gestureHandeling: 'cooperative',
        zoom: 6.3
    };

    let mapContainer = document.querySelector('#map-div');

    map = new google.maps.Map(mapContainer, mapProp);
}
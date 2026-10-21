mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/satellite-streets-v12",
  center: coordinates, // [longitude, latitude]
  zoom: 9,
});

new mapboxgl.Marker({ color: "red" })
  .setLngLat(coordinates)
  .setPopup(
    new mapboxgl.Popup({ offset: 25 }).setText(
      `${listingTitle}, ${listingLocation}`
    )
  )
  .addTo(map);

function setMapStyle(name) {
  map.setStyle(`mapbox://styles/mapbox/${name}`);
}
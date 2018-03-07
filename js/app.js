// declaring global variables
var map;
var infoWindow;

var locations = [
    {
        name : 'GEICO',
        address : '5260 Western Ave, Chevy Chase, MD 20815',
        lat : 38.961097,
        lng : -77.090531
    },
    {
        name : 'Microsoft Corporation',
        address : '5404 Wisconsin Ave # 700, Chevy Chase, MD 20815',
        lat : 38.961877,
        lng : -77.086628
    },
    {
        name : 'Marriott International',
        address : '10400 Fernwood Rd, Bethesda, MD 20817',
        lat : 39.024717,
        lng : -77.138270
    },
    {
        name : 'Host Hotels and Resorts',
        address : '6903 Rockledge Dr, Bethesda, MD 20817',
        lat : 39.027752,
        lng : -77.140337
    },
    {
        name : 'Lockheed Martin Corporation',
        address : '6801 Rockledge Dr, Bethesda, MD 20817',
        lat : 39.030990,
        lng : -77.138944
    }
];

var Location = function(location) {
    var self = this;

    self.name = ko.observable(location.name);
    self.lat = ko.observable(location.lat);
    self.lng = ko.observable(location.lng);
    self.active = ko.observable(false);

    self.getContent = function(callback) {
        // if the content has already been set, return its value
        if (self.content){
            return self.content();
        }

        var wikiUrl = 'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + self.name() + '&format=json&callback=wikiCallback';

        jQuery.ajax({
            url: wikiUrl,
            dataType: 'jsonp',
        })
        .done(function(response) {
            var wikiContent = '';
            if (response){
                if (typeof response[1] !=="undefined" && typeof response[3] !=="undefined"){
                    for (var i = 0; i < 3; i++) {
                        if (typeof response[1][i] !=="undefined" && typeof response[3][i] !=="undefined"){
                            wikiContent += '<a href="' + response[3][i] + '" target"_blank">' + response[1][i] + '</a><br>';
                        }
                    }
                }
            }
            if (wikiContent !== '') {
                self.content = ko.observable('<h4>Wikipedia results for "' + self.name() + '"</h4><p>' + wikiContent + '</p>');                 
            } else {
                self.content = ko.observable('<h4>Wikipedia results for "' + self.name() + '"</h4><p>There was a problem reaching wikipedia, sorry =/</p>');                 
            }
        })
        .fail(function() {
            console.log("error in ajax call to wikipedia's api");
            self.content = ko.observable('<h4>Wikipedia results for "' + self.name() + '"</h4><p>There was a problem reaching wikipedia, sorry =/</p>');                 
        })
        .always(function() {
            if (typeof callback !== "undefined"){
                callback(self);
            }
        });

        // return a spinner for while the external API is still loading
        return '<h4>Wikipedia results for "' + self.name() + '"</h4><p><span class="spinner"></span></p>';
    };

    // create marker for this location object on object construction
    self.createMarker = (function() {

        // create marker for this location
        self.marker = new google.maps.Marker({
            position: {lat: self.lat(), lng: self.lng()},
            map: map,
            title: self.name()
        });

        // extend map bounds with this new marker
        map.bounds.extend(self.marker.position);

        // add click event listener to marker
        self.marker.addListener('click', function() {
            selectLocation(self);
        });

    })();
};

// Google Maps
function initMap() {
    // initialize map
    map = new google.maps.Map(document.getElementById('map'));

    // initialize bounds variable
    map.bounds = new google.maps.LatLngBounds();

    // initialize infoWindow
    infoWindow = new google.maps.InfoWindow({
        content: ''
    });

    google.maps.event.addListener(infoWindow, 'closeclick', function(){
        resetActiveState();
    });

    // add eventListener to resize map when the browser resizes
    google.maps.event.addDomListener(window, 'resize', function() {
        map.fitBounds(map.bounds);
    });
}

var ViewModel = function() {
    var self = this;

    // show UI if the map loads properly
    this.mapNotLoaded = ko.observable(false);

    // initialize locationsList observableArray
    this.locationsList = ko.observableArray([]);

    // add location objects to the locationsList
    locations.forEach(function(location) {
        self.locationsList.push( new Location(location));
    });

    // fit map to new bounds
    map.fitBounds(map.bounds);

    // initialize current location 
    this.currentLocation = ko.observable(locationsList()[0]);

    // initialize searchTerm which is used to filter the list of locations displayed
    this.searchTerm = ko.observable('');
    
    // this function is used to reset any active state that may be set
    this.resetActiveState = function() {
        self.currentLocation().active(false);
        self.currentLocation().marker.setAnimation(null);
        infoWindow.close();
    };

    // compute the list of locations filtered by the searchTerm
    this.filteredLocations = ko.computed(function() {
        // reset any active state
        resetActiveState();

        // return a list of locations filtered by the searchTerm
        return self.locationsList().filter(function (location) {
            var display = true;
            if (self.searchTerm() !== ''){
                // check if the location name contains the searchTerm
                if (location.name().toLowerCase().indexOf(self.searchTerm().toLowerCase()) !== -1){
                    display = true;
                }else {
                    display = false;
                }
            }
            
            // toggle map marker based on the filter
            location.marker.setVisible(display);

            return display;
        });
    });

    // click handler for when a location is clicked
    this.selectLocation = function(clickedLocation) {
        if (self.currentLocation() == clickedLocation && self.currentLocation().active() === true) {
            resetActiveState();
            return;
        }

        // reset any active state
        resetActiveState();

        // update currentLocation
        self.currentLocation(clickedLocation);

        // activate new currentLocation
        self.currentLocation().active(true);

        // bounce marker
        self.currentLocation().marker.setAnimation(google.maps.Animation.BOUNCE);

        // open infoWindow for the current location
        infoWindow.setContent('<h1>' + self.currentLocation().name() + '</h1>' + self.currentLocation().getContent(function(l){
            // This is a call back function passed to Location.getContent()
            // When Location has finished getting info from external API it will call this function
            // check if infoWindow is still open for the location calling this call back function
            if (self.currentLocation() == l){
                infoWindow.setContent('<h1>' + self.currentLocation().name() + '</h1>' + l.content());
            }
        }));
        infoWindow.open(map, self.currentLocation().marker);

        // center map on current marker
        map.panTo(self.currentLocation().marker.position);
    };

    // hide nav initially on mobile
    this.hideNav = ko.observable( window.innerWidth < 640 );

    this.toggleNav = function() {
        self.hideNav(! self.hideNav());
        google.maps.event.trigger(map, 'resize');
        map.fitBounds(map.bounds);
    };
};

// This is called by the maps api as a callback
var app = function() {
    initMap();

    ko.applyBindings(ViewModel);
};

// Fallback for Google Maps Api
function googleMapsApiErrorHandler(){
    console.log('Error: Google maps API has not loaded');
    $('body').prepend('<p id="map-error">Sorry we are having trouble loading google maps API, please try again in a moment.</p>');
}
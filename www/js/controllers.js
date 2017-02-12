app.controller('AppCtrl', function($scope) {
});

app.controller('MapCtrl', function($scope, $state, $cordovaGeolocation, $timeout, $sce, DB, $ionicLoading, $ionicModal) {

  //global variables
  $scope.places = [];
  $scope.currentPlace = {};
  $scope.currentReport = {};
  $scope.currentPlace.name = "Nome teste";
  $scope.currentPlace.vicinity = "endereco";
  $scope.currentPlace.distance = "00 km";
  $scope.currentPlace.category = "Bar";
  $scope.currentPlace.photo = "img/no-photo.jpg";
  $scope.currentReport.status = 4;
  $scope.firstLoad = true;
  $ionicModal.fromTemplateUrl('templates/thermometer.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.thermometerModal = modal;
  });
  //get current location
  var geoOptions = {timeout: 30000, enableHighAccuracy: false};
  var watch = $cordovaGeolocation.watchPosition(geoOptions);
  watch.then(null,
    function(error){ console.log("Could not get location");  },
    function(position) {
      $scope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      if ($scope.firstLoad) {
        initializeMap(position);
        $ionicLoading.show({
          animation: 'fade-in',
          showBackdrop: true,
          maxWidth: 200,
          showDelay: 0,
          template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
          '<br/>Procurando...'
        });
        addMyPositionMarker(position);
        $scope.lastPosition = position;
      } else {
        updateMyPosition($scope.myPositionMarker, $scope.myPosition);
      }

      if ($scope.firstLoad || getDistanceFromLatLonInKm(position, $scope.lastPosition) > 1) {
        //TODO separate searchNearByPlaces and getStatusOfPlaces
        searchNearByPlaces();
        $scope.firstLoad = false;
      }
      if(!$scope.firstLoad) updateStatusMarkers();
      $scope.lastPosition = position;
    });



  /* Map functions */

  function getDistanceFromLatLonInKm(pos1,pos2) {
    var lat1 = pos1.coords.latitude;
    var lon1 = pos1.coords.longitude;

    var lat2 = pos2.coords.latitude;
    var lon2 = pos2.coords.longitude;

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
  }

  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }

  function initializeMap() {

    //style of the map (https://snazzymaps.com/style/18/retro)
    var mapStyle = [
      {
        "featureType": "landscape",
        "elementType": "all",
        "stylers": [
          {
            "hue": "#6600ff"
          },
          {
            "saturation": -11
          }
        ]
      },
      {
        "featureType": "poi",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -78
          },
          {
            "hue": "#6600ff"
          },
          {
            "lightness": "10"
          },
          {
            "visibility": "on"
          }
        ]
      },
      {
        "featureType": "road",
        "elementType": "all",
        "stylers": [
          {
            "hue": "#5e00ff"
          },
          {
            "saturation": -79
          }
        ]
      },
      {
        "featureType": "road.local",
        "elementType": "all",
        "stylers": [
          {
            "lightness": 30
          },
          {
            "weight": 1.3
          }
        ]
      },
      {
        "featureType": "transit",
        "elementType": "all",
        "stylers": [
          {
            "visibility": "simplified"
          },
          {
            "hue": "#5e00ff"
          },
          {
            "saturation": -16
          }
        ]
      },
      {
        "featureType": "transit.line",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -72
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -65
          },
          {
            "hue": "#1900ff"
          },
          {
            "lightness": 8
          }
        ]
      }
    ];

    //map options
    var mapOptions = {
      center: $scope.myPosition,
      zoom: 17,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: mapStyle,
      disableDefaultUI: true,
      clickableIcons: false
    };

    //initialize map
    $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);
  }
  function addMyPositionMarker(){

    //Wait until the map is loaded
    google.maps.event.addListenerOnce($scope.map, 'idle', function(){

      $scope.myPositionMarker = new google.maps.Marker({
        map: $scope.map,
        position: $scope.myPosition,
        icon: 'img/me.png'
      });

      google.maps.event.addListener($scope.myPositionMarker, 'click', function () {
      });

    });
  }

  function updateMyPosition(marker, position) {
    marker.setPosition(position);
  }

  function searchNearByPlaces(){
    //set filters
    var request = {
      location: $scope.myPosition,
      //radius: '5000',
      types: ['bar', 'night_club'],
      rankBy: google.maps.places.RankBy.DISTANCE,
      openNow: true
    };

    //set service
    $scope.placeService = new google.maps.places.PlacesService($scope.map);
    //trigger the search
    $scope.placeService.nearbySearch(request, addPlacesOnMap);
  }

  function addPlacesOnMap(results, status){
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      $scope.places = results;

      for (var i = 0; i < results.length; i++) {
        //for each place found, create marker
        var place = results[i];
        //get status and add marker
        getPlaceExtraInfo(place, i);
        console.log(place);


        //TODO dont increase id when INSERT IGNORE
        var newPlace = {};
        newPlace.place_id = place.place_id;
        newPlace.address = place.vicinity;
        newPlace.name = place.name;
        newPlace.lat = place.geometry.location.lat();
        newPlace.long = place.geometry.location.lng();
        newPlace.type = place.types[0] + " " + place.types[1] + " " + place.types[2];

        DB.savePlaceIfNotExists(newPlace).then(function(result) {
          $ionicLoading.hide();
        });

      }
    }
  }

  //get places Backand infos and add marker
  function getPlaceExtraInfo(place, index){
    DB.getPlaceByPlaceId(place.place_id).then(function(result){
      $scope.places[index].status = result.data[0].status;
      $scope.places[index].lastreport = result.data[0].lastreport;
      //TODO add more details
      addPlaceMarker(place, index);
    });
  }

  function addPlaceMarker(place, index){
    var status = getThermometerMark($scope.places[index].status, $scope.places[index].lastreport);
    //Wait until the map is loaded
    google.maps.event.addListenerOnce($scope.map, 'idle', function(){
      //TODO change icons of markers depending on the status of the place
      $scope.places[index].marker = new google.maps.Marker({
        map: $scope.map,
        animation: google.maps.Animation.DROP,
        position: place.geometry.location,
        icon: 'img/thermometer/'+status+'.png'
      });

      google.maps.event.addListener($scope.places[index].marker, 'click', function () {
        $scope.closePlace(index);
        setCurrentPlace(index);
        $timeout(function(){$scope.openPlace(index)}, 300);
        $scope.map.panTo($scope.currentPlace.geometry.location);

      });

    });
  }

  function getThermometerMark(status, lastreport){
    if(getDateInterval(lastreport) > 3 ) return 0; //if lastreport was earlier than 3 hrs ago, ignore
    if(status == 0 || status == null) return 0;
    if(status < 1.5) return 1;
    if(status >= 1.5 && status < 2.5) return 2;
    if(status >= 2.5 && status < 3.5) return 3;
    if(status >= 3.5 && status < 4.5) return 4;
    if(status >= 4.5 && status < 5.5) return 5;
    if(status >= 5.5 && status < 6.5) return 6;
    if(status >= 6.5 && status < 7.5) return 7;
    if(status >= 7.5 && status < 8.5) return 8;
    if(status >= 8.5 && status < 9.5) return 9;
    if(status >= 9.5) return 10;
  }

  function setCurrentPlace(index){
    $scope.currentPlace = $scope.places[index];

    //set current place main photo
    if(typeof $scope.currentPlace.photos != 'undefined')
      $scope.currentPlace.photo = $sce.trustAsResourceUrl($scope.currentPlace.photos[0].getUrl({'maxWidth': 100, 'maxHeight': 100}));
    else
      $scope.currentPlace.photo = "img/no-photo.jpg";

    //set image of category
    //TODO add restaurant category
    if($scope.currentPlace.types.includes('night_club', 'bar'))
      $scope.currentPlace.category = "Bar Balada";
    else if($scope.currentPlace.types.includes('night_club'))
      $scope.currentPlace.category = "Balada";
    else if($scope.currentPlace.types.includes('bar'))
      $scope.currentPlace.category = "Bar";

    //calculate distance from my position
    calcDistance($scope.myPosition, $scope.currentPlace.geometry.location);

    $scope.$apply();

  }

  function calcDistance(origin, destiny){
    var service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destiny],
        travelMode: google.maps.TravelMode.WALKING
      }, callbackDistance);

    function callbackDistance(response, status) {
      if (status == google.maps.DistanceMatrixStatus.OK) {
        var origins = response.originAddresses;

        for (var i = 0; i < origins.length; i++) {
          var results = response.rows[i].elements;
          for (var j = 0; j < results.length; j++) {
            var element = results[j];
            $scope.currentPlace.distance = element.distance.text;
          }
        }
      }
    }
  }

  function getPlaceDetails(place_id){
    var request = {
      placeId: place_id
    };

    var service = new google.maps.places.PlacesService($scope.map);
    service.getDetails(request,
      function callback(place, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          $scope.currentPlace.allPhotos = place.photos;
          $scope.currentPlace.website = place.website;
          $scope.$apply();
        }else alert(status);
      });
  }

  function saveThermometerReport(){
    $scope.currentReport.place_id = $scope.currentPlace.place_id;
    $scope.currentReport.time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Salvando, obrigado!...'
    });

    //save report to 'reports' table
    DB.saveReport($scope.currentReport).then(function(){
      //get last reports (limit to 10 / 3 hrs ago)
      DB.getReportsFromPlaceId($scope.currentReport.place_id).then(function(result){
        //calc average (pond 3 to first 5, pond 2 to 6...7, pond 1 to 8...10)
        var total = 0;
        var div = 0;
        var lastreport = result.data[0].time;
        result.data.forEach(function(item, index){
          if(index >= 0 && index < 5) {
            total += item.status * 3;
            div += 3;
          }
          else if(index >= 5 && index < 7){
            total += item.status*2;
            div += 2;
          }
          else if(index >= 7){
            total += item.status*1;
            div += 1;
          }
        });

        var avg = total/div;

        //update average and lastreport on places
        DB.updateStatus($scope.currentReport.place_id, avg, lastreport).then(function(result){
          $ionicLoading.hide();
        });
      });
    });




  }

  function getDateInterval(lastreport){
    if(lastreport == null) return 0;
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
    return diffHrs;

  }

  $scope.getLastReport = function(lastreport){
    if(lastreport == null) return 'Sem dados';
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 2 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    if(diffHrs >= 1){
      if(diffHrs > 3) return 'Sem dados recentes';
      else return roundN(1.0,diffHrs) + 'hrs atrás';
    }else{
      return roundN(1.0,diffMins) + 'min atrás';
    }
  };

  function mysqlTimeStampToDate(timestamp) {
    //function parses mysql datetime string and returns javascript Date object
    //input has to be in this format: 2007-06-05 15:26:02
    var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
    var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');
    return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
  }

  function roundN(N,x) {
    if(x > 0)
      return Math.ceil(x/N) * N;
    else if( x < 0)
      return Math.floor(x/N) * N;
    else
      return N;
  }

  function updateStatusMarkers(){
    $scope.places.forEach(function(item, index) {
      getPlaceExtraInfo(item, index);
      updateThermometerMarker(item);
    });
  }

  function updateThermometerMarker(place) {
    var status = getThermometerMark(place.status, place.lastreport);
    place.marker.setIcon("img/thermometer/"+status+".png");
  }


  /* animations and state */
  $scope.openPlace = function(place){
    document.getElementById("place-info").style.bottom = "-285px";
  };

  $scope.moreInfoPlace = function(){
    getPlaceDetails($scope.currentPlace.place_id);
    document.getElementById("place-info").style.bottom = "0";
  };

  $scope.closePlace = function(place){
    if(document.getElementById("place-info").style.bottom == "-285px")
      document.getElementById("place-info").style.bottom = "-480px";
    else
      document.getElementById("place-info").style.bottom = "-285px";
  };


  $scope.openThermometer = function(){
    $scope.thermometerModal.show();
    $scope.currentReport.status = $scope.currentPlace.status;
  };

  $scope.closeThermometer = function(){
    $scope.thermometerModal.hide();
    saveThermometerReport();
    updateStatusMarkers();
  };

  $scope.goToSuggestions = function(){
    $state.go('app.suggestions');
  };

  $scope.getThermIcon = function(status, lastreport){
    return 'img/thermometer/' + getThermometerMark(status, lastreport) + '.png';
  };



});

app.controller('SuggestionsCtrl', function($scope, $stateParams) {
  $scope.toggle = function(id){
    var elems = document.getElementsByClassName('option');
    for(var i = 0; i < elems.length; i++) {
      if(elems[i] != document.getElementById(id))
        elems[i].style.bottom = '-182px';
    }

    if(document.getElementById(id).style.bottom == "-182px")
      document.getElementById(id).style.bottom = "52px";
    else
      document.getElementById(id).style.bottom = "-182px";
  };
});

app.service('DB', function ($http, Backand) {
  var service = this,
    baseUrl = '/1/objects/',
    objectPlaces = 'places/',
    objectReports = 'reports/';

  function getUrl() {
    return Backand.getApiUrl() + baseUrl + objectPlaces;
  }

  function getReportsUrl() {
    return Backand.getApiUrl() + baseUrl + objectReports;
  }

  function getUrlForId(id) {
    return getUrl() + id;
  }

  function escapeString(title) {
    title = title.replace(/'/g, "");
    title = escape(title);
    return title
  }

  //We are not going to use this.
  service.getAllPlaces = function () {
    return $http.get(getUrl());
  };

  //Get unique place by id (Backand)
  service.getPlaceById = function (id) {
    return $http.get(getUrlForId(id));
  };

  //Get unique place by place_id (Google Places)
  service.getPlaceByPlaceId = function (place_id){
    return $http ({
      method: 'POST',
      url: Backand.getApiUrl() + '/1/query/data/getPlaceByPlaceId',
      params: {
        parameters: {
          place_id: place_id
        }
      }
    });
  };

  /*service.placeExists = function(place, callback){
    this.getPlaceByPlaceId(place.place_id).then(function (result) {
      if(result.data.length > 0) callback(true);
      else callback(false);
    });
  };*/

  //Save place
  service.savePlace = function (object) {
    return $http.post(getUrl(), object);
  };



  service.savePlaceIfNotExists= function(place){

    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/insertIfNotExists',
      params: {
        parameters: {
          place_id: place.place_id,
          address: escapeString(place.address),
          name: escapeString(place.name),
          type: place.type,
          lat: place.lat,
          long: place.long
        }
      }
    });
  };

  //Update place info
  service.updatePlace = function (id, object) {
    return $http.put(getUrlForId(id), object);
  };

  //Delete place
  service.deletePlace = function (id) {
    return $http.delete(getUrlForId(id));
  };


  /* Reports */
  service.saveReport = function (object) {
    return $http.post(getReportsUrl(), object);
  };

  service.getReportsFromPlaceId = function (place_id) {
    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/selectLastReports',
      params: {
        parameters: {
          place_id: place_id
        }
      }
    });
  };

  service.updateStatus = function(place_id, status, lastreport){
    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/updateStatus',
      params: {
        parameters: {
          place_id: place_id,
          status: status,
          lastreport: lastreport
        }
      }
    });
  };




});

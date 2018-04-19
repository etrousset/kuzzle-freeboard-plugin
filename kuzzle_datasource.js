(function() {
  freeboard.loadDatasourcePlugin({
    type_name: "kuzzle_subscribe_data",
    display_name: "Kuzzle Datasource",
    description: "Monitor Kuzzle Documents",
    external_scripts: ["node_modules/kuzzle-sdk/dist/kuzzle.js"],
    settings: [
      {
        name: "kuzzle_host",
        display_name: "Kuzzle host",
        type: "text",
        default_value: "localhost",
        description: "URL to you Kuzzle instance"
      },
      {
        name: "kuzzle_port",
        display_name: "Kuzzle port",
        type: "text",
        default_value: 7512,
        description: "Kuzzle port"
      },
      {
        name: "kuzzle_token",
        display_name: "Token",
        type: "text",
        description:
          "API token retreived using: https://docs.kuzzle.io/api-documentation/controller-auth/login/"
      },
      {
        name: "kuzzle_index",
        display_name: "Index",
        type: "text",
        description: "The index that holds the collection"
      },
      {
        name: "kuzzle_collection",
        display_name: "Collection",
        type: "text",
        description: "The collection"
      },
      {
        name: "kuzzle_subscribe_query",
        display_name: "Subscribe query",
        type: "text",
        description:
          "The subscribe query: https://docs.kuzzle.io/sdk-reference/collection/subscribe/"
      }
    ],
    newInstance: function(settings, newInstanceCallback, updateCallback) {
      newInstanceCallback(new myDatasourcePlugin(settings, updateCallback));
    }
  });

  var myDatasourcePlugin = function(settings, updateCallback) {
    var self = this
    var currentSettings = settings
    var room = null

    var kuzzle = new Kuzzle(
      currentSettings.kuzzle_host,
      {
        port: currentSettings.kuzzle_port,
        defaultIndex: currentSettings.kuzzle_index
      },
      err => {
        if (err) {
          console.log(err);
        } else {
          if(currentSettings.kuzzle_token)
            kuzzle.setToken(currentSettings.kuzzle_token)

					console.log(Promise);
					self.check_kuzzle_index()
        }
      }
    );

    self.check_kuzzle_collection = () => {
      kuzzle.listCollections(
        currentSettings.kuzzle_index,
        { type: "stored" },
        (err, res) => {
          if (err) {
            console.error(err);
          } else {
            console.log(res);
            if (res.find((e, i) => e.name === currentSettings.kuzzle_collection)) {
              console.log("Found collection: %s", currentSettings.kuzzle_collection);
              self.subscribe_to_filter(currentSettings.kuzzle_subscribe_query);
            } else {
              console.error(
                "Collection not found: %s",
                currentSettings.kuzzle_collection
              );
            }
          }
        }
      );
    };

    self.check_kuzzle_index = () => {
      kuzzle.listIndexes((err, indexes) => {
        if (!indexes.includes(currentSettings.kuzzle_index))
          console.error(
            'Your kuzzle instance doesn\'t have "%s" index',
            currentSettings.kuzzle_index
          );
        else {
					self.check_kuzzle_collection(currentSettings.kuzzle_collection)
        }
      });
    };

    self.subscribe_to_filter = filter => {
      device_state_col = kuzzle.collection(currentSettings.kuzzle_collection);
      try {
        filter = JSON.parse(filter);
      } catch (e) {
				console.log(e)
        console.error("Failed to parse subsciption filter: ", filter);
        console.log("See https://docs.kuzzle.io/sdk-reference/collection/subscribe/ and https://docs.kuzzle.io/kuzzle-dsl/essential/koncorde/ for details on how to write filters")
        return;
      }

      device_state_col
        .subscribe(
          filter,
          {},
          (err, res) => {
            // console.log(res);
            if (res.action === "create") {
              var content = res.document.content;
              updateCallback(content);
            }
          }
        )
        .onDone( (err, roomObject) => {
          if(err) {
            console.error(err)
          }
          else {
            self.room = roomObject
            console.log("[DONE] Subscribing to device state");
          }
        });
    };

    self.onSettingsChanged = function(newSettings) {
      currentSettings = newSettings;
      if(self.room) {
        self.room.unsubscribe()
        self.room = null
      }
        self.check_kuzzle_index()
    };

    self.updateNow = function() {
      console.log(
        "TODO: search for latest document corresponding that woould have triggered the subscription notification"
      );
    };

    self.onDispose = function() {
      kuzzle.disconnect();
    };
  };
})();

# Bus-Routes

## Summary

We use the datasets in [GTFS](https://gtfs.org/documentation/schedule/reference/) format, its an international standard.

The data will be stored as a PostgreSQL database for ease of access. The extension [gtfs-via-postgres](https://github.com/public-transport/gtfs-via-postgres) for Node is going to be very useful.

The container with the db will eventually run on a different server inside the network so we want to make it easy to configure the IP of this server in the future.

## Implementation

The route from that will be displayed can be fetched with: (test.http)

```http request
GET http://localhost:3000/api/bus/route?lon_a=14.27502937&lat_a=48.29107692&lon_b=14.26712419&lat_b=48.30039407&departure_time=08:30:00&max_transfers=2
```

The coordinates of the **start point** as well as the **end point** need to be provided as well as the **departure time** and **max number of transfers**.

The Coordinates will be determent through [**Google Places Autocomplete API**](./google.md) or optionally though manual input.
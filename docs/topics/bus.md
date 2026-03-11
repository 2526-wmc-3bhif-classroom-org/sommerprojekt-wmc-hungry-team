# Bus-Routes

## Summary

We use the datasets in [GTFS](https://gtfs.org/documentation/schedule/reference/) format, its an international standard.

The data will be stored as a PostgreSQL database for ease of access. The extension [gtfs-via-postgres](https://github.com/public-transport/gtfs-via-postgres) for Node is going to be very useful.

The container with the db will eventually run on a different server inside the network so we want to make it easy to configure the IP of this server in the future.



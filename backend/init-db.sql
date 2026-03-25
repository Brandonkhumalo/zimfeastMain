-- Create separate databases for each microservice
CREATE DATABASE zimfeast_auth;
CREATE DATABASE zimfeast_restaurants;
CREATE DATABASE zimfeast_orders;
CREATE DATABASE zimfeast_payments;

-- Enable PostGIS extension on databases that use geospatial queries
\connect zimfeast_restaurants;
CREATE EXTENSION IF NOT EXISTS postgis;

\connect zimfeast_orders;
CREATE EXTENSION IF NOT EXISTS postgis;

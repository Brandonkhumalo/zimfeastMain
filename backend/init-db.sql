-- Create separate databases for each microservice
CREATE DATABASE zimfeast_auth;
CREATE DATABASE zimfeast_restaurants;
CREATE DATABASE zimfeast_orders;
CREATE DATABASE zimfeast_payments;

-- Plain PostgreSQL is enough for the current schema. Distance calculations use
-- latitude/longitude columns in application code.

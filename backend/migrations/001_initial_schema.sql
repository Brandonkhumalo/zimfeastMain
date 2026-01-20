CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);

CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);

CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);

CREATE TABLE "accounts_blacklistedtoken" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "token" varchar(255) NOT NULL UNIQUE, "blacklisted_at" datetime NOT NULL);

CREATE TABLE "accounts_customuser" ("password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "id" char(32) NOT NULL PRIMARY KEY, "email" varchar(254) NOT NULL UNIQUE, "first_name" varchar(255) NOT NULL, "last_name" varchar(255) NOT NULL, "phone_number" varchar(50) NOT NULL, "role" varchar(30) NOT NULL, "is_active" bool NOT NULL, "is_staff" bool NOT NULL);

CREATE TABLE "accounts_customuser_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "customuser_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "accounts_customuser_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "customuser_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "accounts_address" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "label" varchar(100) NOT NULL, "address_text" varchar(255) NOT NULL, "lat" real NOT NULL, "lng" real NOT NULL, "created" datetime NOT NULL, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "action_time" datetime NOT NULL);

CREATE TABLE "restaurants_cuisinetype" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(100) NOT NULL UNIQUE);

CREATE TABLE "restaurants_restaurant" ("id" char(32) NOT NULL PRIMARY KEY, "name" varchar(255) NOT NULL, "phone_number" varchar(30) NOT NULL, "description" text NOT NULL, "full_address" varchar(500) NOT NULL, "lat" real NOT NULL, "lng" real NOT NULL, "minimum_order_price" decimal NOT NULL, "est_delivery_time" varchar(50) NOT NULL, "created" datetime NOT NULL, "owner_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "profile_image" varchar(100) NULL);

CREATE TABLE "restaurants_restaurant_cuisines" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "restaurant_id" char(32) NOT NULL REFERENCES "restaurants_restaurant" ("id") DEFERRABLE INITIALLY DEFERRED, "cuisinetype_id" bigint NOT NULL REFERENCES "restaurants_cuisinetype" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "restaurants_restaurantdashboard" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "today_orders" integer NOT NULL, "today_revenue" decimal NOT NULL, "today_average_rating" real NOT NULL, "preparing" text NOT NULL CHECK ((JSON_VALID("preparing") OR "preparing" IS NULL)), "pending" text NOT NULL CHECK ((JSON_VALID("pending") OR "pending" IS NULL)), "completed" text NOT NULL CHECK ((JSON_VALID("completed") OR "completed" IS NULL)), "last_updated" datetime NOT NULL, "restaurant_id" char(32) NOT NULL UNIQUE REFERENCES "restaurants_restaurant" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "restaurants_restaurantexternalapi" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "category" varchar(100) NOT NULL, "api_url" varchar(200) NOT NULL, "api_key" varchar(255) NULL, "restaurant_id" char(32) NOT NULL REFERENCES "restaurants_restaurant" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "drivers_driverorderstatus" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "status" varchar(50) NOT NULL, "assigned_at" datetime NOT NULL, "completed_at" datetime NULL, "driver_id" char(32) NOT NULL REFERENCES "drivers_driver" ("id") DEFERRABLE INITIALLY DEFERRED, "order_id" char(32) NOT NULL UNIQUE REFERENCES "orders_order" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "drivers_driverreject" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "order_id" varchar(100) NOT NULL, "reason" varchar(255) NOT NULL, "rejected_at" datetime NOT NULL, "driver_id" char(32) NOT NULL REFERENCES "drivers_driver" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "payments_feastvoucher" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "balance" decimal NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "payments_payment" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "reference" varchar(100) NOT NULL UNIQUE, "amount" decimal NOT NULL, "method" varchar(20) NOT NULL, "status" varchar(20) NOT NULL, "created_at" datetime NOT NULL, "order_id" char(32) NULL REFERENCES "orders_order" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);

CREATE TABLE "orders_orderitem" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "quantity" integer unsigned NOT NULL CHECK ("quantity" >= 0), "added" datetime NOT NULL, "menu_item_id" char(32) NOT NULL REFERENCES "restaurants_menuitem" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "order_id" char(32) NULL REFERENCES "orders_order" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "restaurants_categorytype" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(100) NOT NULL UNIQUE);

CREATE TABLE "restaurants_menuitem_category" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "menuitem_id" char(32) NOT NULL REFERENCES "restaurants_menuitem" ("id") DEFERRABLE INITIALLY DEFERRED, "categorytype_id" bigint NOT NULL REFERENCES "restaurants_categorytype" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "drivers_driver" ("id" char(32) NOT NULL PRIMARY KEY, "license_number" varchar(50) NOT NULL, "license_photo" varchar(100) NOT NULL, "vehicle_photo" varchar(100) NOT NULL, "is_online" bool NOT NULL, "lat" real NULL, "lng" real NULL, "user_id" char(32) NOT NULL UNIQUE REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "vehicle_details" text NOT NULL CHECK ((JSON_VALID("vehicle_details") OR "vehicle_details" IS NULL)));

CREATE TABLE "drivers_driverfinance" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "date" date NOT NULL, "today_deliveries" integer NOT NULL, "today_earnings" decimal NOT NULL, "rating_sum" decimal NOT NULL, "rating_count" integer NOT NULL, "hours_online" decimal NOT NULL, "last_updated" datetime NOT NULL, "driver_id" char(32) NOT NULL REFERENCES "drivers_driver" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "drivers_driverrating" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "rating" decimal NOT NULL, "comment" text NULL, "created_at" datetime NOT NULL, "driver_id" char(32) NOT NULL REFERENCES "drivers_driver" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "restaurants_menuitem" ("id" char(32) NOT NULL PRIMARY KEY, "name" varchar(255) NOT NULL, "price" decimal NOT NULL, "description" text NOT NULL, "prep_time" integer NULL, "available" bool NOT NULL, "created" datetime NOT NULL, "restaurant_id" char(32) NOT NULL REFERENCES "restaurants_restaurant" ("id") DEFERRABLE INITIALLY DEFERRED, "item_image" varchar(100) NOT NULL);

CREATE TABLE "orders_order" ("id" char(32) NOT NULL PRIMARY KEY, "created" datetime NOT NULL, "restaurant_names" text NOT NULL, "total_fee" decimal NOT NULL, "tip" decimal NOT NULL, "each_item_price" text NOT NULL CHECK ((JSON_VALID("each_item_price") OR "each_item_price" IS NULL)), "delivery_out_time" datetime NULL, "delivery_complete_time" datetime NULL, "external_order_numbers" text NOT NULL CHECK ((JSON_VALID("external_order_numbers") OR "external_order_numbers" IS NULL)), "delivery_fee" decimal NOT NULL, "customer_id" char(32) NOT NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "driver_id" char(32) NULL REFERENCES "accounts_customuser" ("id") DEFERRABLE INITIALLY DEFERRED, "restaurant_id" char(32) NOT NULL REFERENCES "restaurants_restaurant" ("id") DEFERRABLE INITIALLY DEFERRED, "delivery_lat" real NULL, "delivery_lng" real NULL, "method" varchar(20) NULL, "restaurant_lat" real NULL, "restaurant_lng" real NULL, "status" varchar(50) NOT NULL, "delivery_address" text NULL, "driver_name" varchar(255) NULL, "driver_phone" varchar(50) NULL, "driver_vehicle" varchar(255) NULL);


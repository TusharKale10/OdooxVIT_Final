-- =========================================================
-- Appointment Booking System - MySQL Schema
-- =========================================================
DROP DATABASE IF EXISTS appointment_app;
CREATE DATABASE appointment_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE appointment_app;

-- ---------- USERS ----------
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('customer','admin','organiser') NOT NULL DEFAULT 'customer',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  otp_code        VARCHAR(10)  NULL,
  otp_expires_at  DATETIME     NULL,
  is_verified     TINYINT(1)   NOT NULL DEFAULT 0,
  reset_token     VARCHAR(120) NULL,
  reset_expires_at DATETIME    NULL,
  phone           VARCHAR(40)  NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB;

-- ---------- SERVICES (appointment types) ----------
CREATE TABLE services (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  organiser_id          INT NOT NULL,
  name                  VARCHAR(160) NOT NULL,
  description           TEXT,
  duration_minutes      INT NOT NULL DEFAULT 30,
  venue                 VARCHAR(255),
  price                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_percent           DECIMAL(5,2)  NOT NULL DEFAULT 0,
  manage_capacity       TINYINT(1) NOT NULL DEFAULT 0,
  max_per_slot          INT NOT NULL DEFAULT 1,
  advance_payment       TINYINT(1) NOT NULL DEFAULT 0,
  manual_confirmation   TINYINT(1) NOT NULL DEFAULT 0,
  assignment_mode       ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  schedule_type         ENUM('weekly','flexible') NOT NULL DEFAULT 'weekly',
  resource_kind         ENUM('user','resource') NOT NULL DEFAULT 'user',
  is_published          TINYINT(1) NOT NULL DEFAULT 0,
  share_token           VARCHAR(64) NOT NULL UNIQUE,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_org FOREIGN KEY (organiser_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_services_published (is_published),
  INDEX idx_services_org (organiser_id)
) ENGINE=InnoDB;

-- ---------- RESOURCES / PROVIDERS attached to a service ----------
CREATE TABLE resources (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  service_id  INT NOT NULL,
  name        VARCHAR(160) NOT NULL,
  user_id     INT NULL,            -- if resource_kind='user'
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_resources_service (service_id)
) ENGINE=InnoDB;

-- ---------- WEEKLY SCHEDULES (for schedule_type='weekly') ----------
CREATE TABLE weekly_schedules (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  service_id   INT NOT NULL,
  day_of_week  TINYINT NOT NULL,    -- 0=Sun .. 6=Sat
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  CONSTRAINT fk_ws_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_ws_service_day (service_id, day_of_week)
) ENGINE=InnoDB;

-- ---------- FLEXIBLE / SPECIFIC AVAILABILITY SLOTS ----------
CREATE TABLE availability_slots (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  service_id      INT NOT NULL,
  start_datetime  DATETIME NOT NULL,
  end_datetime    DATETIME NOT NULL,
  CONSTRAINT fk_av_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_av_service_start (service_id, start_datetime)
) ENGINE=InnoDB;

-- ---------- BOOKING QUESTIONS (per service) ----------
CREATE TABLE booking_questions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  service_id   INT NOT NULL,
  question     VARCHAR(255) NOT NULL,
  field_type   ENUM('text','textarea','number','phone','email') NOT NULL DEFAULT 'text',
  is_required  TINYINT(1) NOT NULL DEFAULT 1,
  sort_order   INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_q_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_q_service (service_id)
) ENGINE=InnoDB;

-- ---------- BOOKINGS ----------
CREATE TABLE bookings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  service_id      INT NOT NULL,
  resource_id     INT NOT NULL,
  customer_id     INT NOT NULL,
  start_datetime  DATETIME NOT NULL,
  end_datetime    DATETIME NOT NULL,
  capacity_taken  INT NOT NULL DEFAULT 1,
  status          ENUM('pending','reserved','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  payment_status  ENUM('not_required','pending','paid','refunded') NOT NULL DEFAULT 'not_required',
  total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_book_service  FOREIGN KEY (service_id)  REFERENCES services(id),
  CONSTRAINT fk_book_resource FOREIGN KEY (resource_id) REFERENCES resources(id),
  CONSTRAINT fk_book_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  INDEX idx_book_slot   (resource_id, start_datetime, status),
  INDEX idx_book_service_slot (service_id, start_datetime, status),
  INDEX idx_book_customer (customer_id),
  INDEX idx_book_status (status)
) ENGINE=InnoDB;

-- ---------- BOOKING ANSWERS ----------
CREATE TABLE booking_answers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  question_id INT NOT NULL,
  answer_text TEXT NOT NULL,
  CONSTRAINT fk_ba_book FOREIGN KEY (booking_id)  REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_ba_q    FOREIGN KEY (question_id) REFERENCES booking_questions(id) ON DELETE CASCADE,
  INDEX idx_ba_book (booking_id)
) ENGINE=InnoDB;

-- ---------- PAYMENTS ----------
CREATE TABLE payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  booking_id     INT NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  method         ENUM('credit_card','debit_card','upi','paypal') NOT NULL,
  status         ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(120) NULL,
  paid_at        DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_book FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_pay_book (booking_id),
  INDEX idx_pay_status (status)
) ENGINE=InnoDB;

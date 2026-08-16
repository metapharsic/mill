--
-- PostgreSQL database dump
--

\restrict rXGnN2ovn95Qq2zbYVQ7Mvr650gTn1ZjhiXXaoVWITBlCaeI1hsJ5ubVtYYQTK6

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: seed_clearance_items(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_clearance_items(p_sep_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO clearance_items (separation_id, dept_name, item_description) VALUES
    (p_sep_id, 'IT',         'Return laptop / PC / peripherals'),
    (p_sep_id, 'IT',         'Revoke system and ERP access'),
    (p_sep_id, 'Security',   'Return ID card and access badge'),
    (p_sep_id, 'HR',         'Return appointment / policy documents'),
    (p_sep_id, 'Finance',    'Settle advances and outstanding loans'),
    (p_sep_id, 'Store',      'Return tools / equipment / uniform'),
    (p_sep_id, 'Dept Head',  'Knowledge transfer completed'),
    (p_sep_id, 'HR',         'Issue experience certificate');
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adjustment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adjustment_requests (
    id integer NOT NULL,
    material_id integer NOT NULL,
    qty numeric(12,3) NOT NULL,
    reason text NOT NULL,
    bin_location character varying(30),
    batch_number character varying(50),
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    requested_by integer NOT NULL,
    approved_by integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT adjustment_requests_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text])))
);


--
-- Name: adjustment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.adjustment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adjustment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.adjustment_requests_id_seq OWNED BY public.adjustment_requests.id;


--
-- Name: appraisal_competencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisal_competencies (
    id integer NOT NULL,
    cycle_id integer NOT NULL,
    employee_id integer NOT NULL,
    competency character varying(100) NOT NULL,
    self_rating numeric(3,1),
    manager_rating numeric(3,1),
    comments text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appraisal_competencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appraisal_competencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appraisal_competencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appraisal_competencies_id_seq OWNED BY public.appraisal_competencies.id;


--
-- Name: appraisal_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisal_cycles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    year integer NOT NULL,
    cycle_type character varying(20) DEFAULT 'Annual'::character varying,
    start_date date NOT NULL,
    end_date date NOT NULL,
    goal_set_deadline date,
    self_review_deadline date,
    manager_review_deadline date,
    status character varying(20) DEFAULT 'Draft'::character varying,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT appraisal_cycles_cycle_type_check CHECK (((cycle_type)::text = ANY (ARRAY[('Annual'::character varying)::text, ('Half-Yearly'::character varying)::text, ('Quarterly'::character varying)::text]))),
    CONSTRAINT appraisal_cycles_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Active'::character varying)::text, ('Completed'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: appraisal_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appraisal_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appraisal_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appraisal_cycles_id_seq OWNED BY public.appraisal_cycles.id;


--
-- Name: appraisal_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisal_goals (
    id integer NOT NULL,
    cycle_id integer NOT NULL,
    employee_id integer NOT NULL,
    goal_title character varying(200) NOT NULL,
    description text,
    weightage numeric(5,2) DEFAULT 0,
    kpi_target text,
    kpi_actual text,
    self_rating numeric(3,1),
    manager_rating numeric(3,1),
    final_rating numeric(3,1),
    set_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appraisal_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appraisal_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appraisal_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appraisal_goals_id_seq OWNED BY public.appraisal_goals.id;


--
-- Name: approval_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix (
    id integer NOT NULL,
    tier integer NOT NULL,
    label character varying(30) NOT NULL,
    min_value numeric(14,2) DEFAULT 0 NOT NULL,
    max_value numeric(14,2),
    required_level integer NOT NULL,
    description text
);


--
-- Name: approval_matrix_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_matrix_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_matrix_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_matrix_id_seq OWNED BY public.approval_matrix.id;


--
-- Name: asset_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_events (
    id integer NOT NULL,
    asset_id integer,
    event_type character varying(30) NOT NULL,
    event_date timestamp without time zone DEFAULT now(),
    recorded_by integer,
    remarks text
);


--
-- Name: asset_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_events_id_seq OWNED BY public.asset_events.id;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    employee_id integer,
    date date NOT NULL,
    shift_type character varying(10),
    in_time timestamp without time zone,
    out_time timestamp without time zone,
    hours_worked numeric(5,2),
    status character varying(20) DEFAULT 'Present'::character varying,
    remarks text,
    CONSTRAINT attendance_status_check CHECK (((status)::text = ANY (ARRAY[('Present'::character varying)::text, ('Absent'::character varying)::text, ('Half Day'::character varying)::text, ('Leave'::character varying)::text, ('Holiday'::character varying)::text, ('OT'::character varying)::text])))
);


--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: attendance_regularization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_regularization (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    attendance_date date NOT NULL,
    in_time time without time zone,
    out_time time without time zone,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'Pending'::character varying,
    applied_on timestamp with time zone DEFAULT now(),
    approved_by integer,
    approved_on timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_regularization_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text])))
);


--
-- Name: attendance_regularization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_regularization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_regularization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_regularization_id_seq OWNED BY public.attendance_regularization.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(50) NOT NULL,
    module character varying(50),
    record_id integer,
    old_data jsonb,
    new_data jsonb,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: boiler_performance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boiler_performance_logs (
    id integer NOT NULL,
    log_time timestamp with time zone NOT NULL,
    steam_flow_kgh numeric(10,2) NOT NULL,
    steam_pressure_bar numeric(6,2) NOT NULL,
    feedwater_temp_c numeric(5,2) NOT NULL,
    flue_gas_temp_c numeric(5,2),
    husk_consumed_kg numeric(10,2) NOT NULL,
    blowdown_rate_pct numeric(4,2) DEFAULT 0,
    efficiency_pct numeric(5,2),
    logged_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boiler_performance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boiler_performance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boiler_performance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boiler_performance_logs_id_seq OWNED BY public.boiler_performance_logs.id;


--
-- Name: chemical_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chemical_consumption (
    id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(10) NOT NULL,
    chemical_id integer,
    qty_consumed numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_cost numeric(14,2) DEFAULT 0 NOT NULL,
    recorded_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: chemical_consumption_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chemical_consumption_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chemical_consumption_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chemical_consumption_id_seq OWNED BY public.chemical_consumption.id;


--
-- Name: chemical_limit_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chemical_limit_alerts (
    id integer NOT NULL,
    alert_date date NOT NULL,
    chemical_id integer,
    actual_ratio numeric(10,3),
    standard_ratio numeric(10,3),
    status character varying(20) DEFAULT 'Active'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chemical_limit_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chemical_limit_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chemical_limit_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chemical_limit_alerts_id_seq OWNED BY public.chemical_limit_alerts.id;


--
-- Name: clearance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clearance_items (
    id integer NOT NULL,
    separation_id integer NOT NULL,
    department_id integer,
    dept_name character varying(100),
    item_description character varying(200) NOT NULL,
    status character varying(20) DEFAULT 'Pending'::character varying,
    cleared_by integer,
    cleared_on timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT clearance_items_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Cleared'::character varying)::text, ('Rejected'::character varying)::text])))
);


--
-- Name: clearance_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clearance_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clearance_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clearance_items_id_seq OWNED BY public.clearance_items.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    code character varying(20),
    name character varying(150) NOT NULL,
    gstin character varying(20),
    pan character varying(12),
    address text,
    city character varying(100),
    state character varying(100),
    pincode character varying(10),
    contact_person character varying(100),
    mobile character varying(15),
    email character varying(150),
    credit_limit numeric(15,2) DEFAULT 0,
    credit_days integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    deleted_by integer
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: daily_production_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_production_reports (
    id integer NOT NULL,
    report_date date NOT NULL,
    machine_id integer,
    pmc_production_mt numeric(12,3) DEFAULT 0,
    finish_production_mt numeric(12,3) DEFAULT 0,
    total_sets integer DEFAULT 0,
    running_minutes integer DEFAULT 0,
    down_minutes integer DEFAULT 0,
    furnish_local_mt numeric(12,3) DEFAULT 0,
    furnish_occ_mt numeric(12,3) DEFAULT 0,
    furnish_total_mt numeric(12,3) DEFAULT 0,
    power_units numeric(12,2) DEFAULT 0,
    dg_units numeric(12,2) DEFAULT 0,
    rice_husk_mt numeric(12,3) DEFAULT 0,
    total_steam_mt numeric(12,3) DEFAULT 0,
    status character varying(20) DEFAULT 'Draft'::character varying,
    remarks text,
    created_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    start_time character varying(20),
    end_time character varying(20),
    gsm_raw character varying(100),
    bf_raw character varying(100),
    draw_avg numeric(8,2) DEFAULT 0,
    machine_speed_avg numeric(8,2) DEFAULT 0,
    moisture_pct_avg numeric(5,2) DEFAULT 0,
    prv_pressure_temp character varying(50),
    pulper_running_minutes integer DEFAULT 0,
    pulper_units numeric(12,2) DEFAULT 0,
    etp_inlet_ppm numeric(8,2) DEFAULT 0,
    etp_outlet_ppm numeric(8,2) DEFAULT 0,
    etp_inlet_flow numeric(12,2) DEFAULT 0,
    etp_outlet_flow numeric(12,2) DEFAULT 0,
    fresh_water_mt numeric(12,3) DEFAULT 0,
    feed_water_mt numeric(12,3) DEFAULT 0,
    condensate_water_mt numeric(12,3) DEFAULT 0,
    CONSTRAINT daily_production_reports_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Submitted'::character varying)::text, ('Approved'::character varying)::text])))
);


--
-- Name: daily_production_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_production_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_production_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_production_reports_id_seq OWNED BY public.daily_production_reports.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    category character varying(40)
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: dispatch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_items (
    id integer NOT NULL,
    dispatch_id integer,
    reel_id integer,
    weight_kg numeric(10,3)
);


--
-- Name: dispatch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispatch_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispatch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispatch_items_id_seq OWNED BY public.dispatch_items.id;


--
-- Name: dispatch_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_orders (
    id integer NOT NULL,
    do_number character varying(30) NOT NULL,
    date date NOT NULL,
    so_id integer,
    customer_id integer,
    vehicle_number character varying(20),
    driver_name character varying(100),
    driver_mobile character varying(15),
    transporter character varying(150),
    lr_number character varying(50),
    eway_bill character varying(30),
    invoice_number character varying(30),
    total_weight_kg numeric(12,3),
    total_reels integer,
    status character varying(20) DEFAULT 'Loading'::character varying,
    dispatched_by integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT dispatch_orders_status_check CHECK (((status)::text = ANY (ARRAY[('Loading'::character varying)::text, ('Loaded'::character varying)::text, ('Dispatched'::character varying)::text, ('Delivered'::character varying)::text, ('Returned'::character varying)::text])))
);


--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispatch_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispatch_orders_id_seq OWNED BY public.dispatch_orders.id;


--
-- Name: downtime_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downtime_entries (
    id integer NOT NULL,
    shift_id integer,
    machine_id integer,
    reel_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration_min integer,
    category character varying(50),
    reason text,
    corrective_action text,
    reported_by integer,
    created_at timestamp without time zone DEFAULT now(),
    reason_code_id integer
);


--
-- Name: downtime_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.downtime_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: downtime_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.downtime_entries_id_seq OWNED BY public.downtime_entries.id;


--
-- Name: downtime_reason_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downtime_reason_codes (
    id integer NOT NULL,
    reason_code character varying(30) NOT NULL,
    category character varying(30) NOT NULL,
    subcategory character varying(50),
    component character varying(100),
    description character varying(200) NOT NULL,
    is_breakdown boolean DEFAULT true,
    severity character varying(20) DEFAULT 'Medium'::character varying,
    typical_minutes integer,
    is_active boolean DEFAULT true
);


--
-- Name: downtime_reason_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.downtime_reason_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: downtime_reason_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.downtime_reason_codes_id_seq OWNED BY public.downtime_reason_codes.id;


--
-- Name: dpr_chemical_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpr_chemical_lines (
    id integer NOT NULL,
    report_id integer NOT NULL,
    chemical_name character varying(100) NOT NULL,
    chemical_id integer,
    qty_kg numeric(12,3) DEFAULT 0,
    sort_order integer DEFAULT 0
);


--
-- Name: dpr_chemical_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dpr_chemical_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dpr_chemical_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dpr_chemical_lines_id_seq OWNED BY public.dpr_chemical_lines.id;


--
-- Name: dpr_downtime_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpr_downtime_lines (
    id integer NOT NULL,
    report_id integer NOT NULL,
    shift character varying(20),
    minutes integer DEFAULT 0,
    reason text,
    sort_order integer DEFAULT 0,
    reason_code character varying(30)
);


--
-- Name: dpr_downtime_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dpr_downtime_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dpr_downtime_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dpr_downtime_lines_id_seq OWNED BY public.dpr_downtime_lines.id;


--
-- Name: dpr_grade_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpr_grade_standards (
    id integer NOT NULL,
    grade_code character varying(20) NOT NULL,
    starch_kg_per_ton numeric(8,3) DEFAULT 0,
    pac_kg_per_ton numeric(8,3) DEFAULT 0,
    surface_size_kg_per_ton numeric(8,3) DEFAULT 0,
    coagulant_kg_per_ton numeric(8,3) DEFAULT 0,
    deformer_kg_per_ton numeric(8,3) DEFAULT 0,
    retention_kg_per_ton numeric(8,3) DEFAULT 0,
    power_unit_per_ton numeric(8,3) DEFAULT 0,
    steam_mt_per_ton numeric(8,3) DEFAULT 0,
    husk_mt_per_ton numeric(8,3) DEFAULT 0,
    yield_pct numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    se_bond_kg_per_ton numeric(8,3) DEFAULT 0.000,
    sigmaexor_etp_kg_per_ton numeric(8,3) DEFAULT 0.000
);


--
-- Name: dpr_grade_standards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dpr_grade_standards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dpr_grade_standards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dpr_grade_standards_id_seq OWNED BY public.dpr_grade_standards.id;


--
-- Name: dpr_gsm_breakup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpr_gsm_breakup (
    id integer NOT NULL,
    report_id integer NOT NULL,
    gsm numeric(6,1) NOT NULL,
    bf numeric(6,1),
    sets integer DEFAULT 0,
    production_mt numeric(12,3) DEFAULT 0,
    sort_order integer DEFAULT 0
);


--
-- Name: dpr_gsm_breakup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dpr_gsm_breakup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dpr_gsm_breakup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dpr_gsm_breakup_id_seq OWNED BY public.dpr_gsm_breakup.id;


--
-- Name: ehs_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ehs_incidents (
    id integer NOT NULL,
    incident_number character varying(30),
    date date DEFAULT CURRENT_DATE NOT NULL,
    incident_time time without time zone,
    incident_type character varying(50),
    severity character varying(20),
    location character varying(100),
    department_id integer,
    description text NOT NULL,
    injured_person character varying(100),
    root_cause text,
    corrective_action text,
    reported_by integer,
    status character varying(20) DEFAULT 'Open'::character varying,
    closure_date date,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ehs_incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ehs_incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ehs_incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ehs_incidents_id_seq OWNED BY public.ehs_incidents.id;


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    doc_type character varying(50) NOT NULL,
    doc_name character varying(200) NOT NULL,
    file_url text NOT NULL,
    file_size_kb integer,
    uploaded_by integer,
    valid_from date,
    valid_to date,
    is_confidential boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_documents_id_seq OWNED BY public.employee_documents.id;


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_balances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    year integer NOT NULL,
    opening_balance numeric(6,2) DEFAULT 0,
    credited numeric(6,2) DEFAULT 0,
    availed numeric(6,2) DEFAULT 0,
    encashed numeric(6,2) DEFAULT 0,
    lapsed numeric(6,2) DEFAULT 0,
    closing_balance numeric(6,2) GENERATED ALWAYS AS (((((opening_balance + credited) - availed) - encashed) - lapsed)) STORED,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_leave_balances_id_seq OWNED BY public.employee_leave_balances.id;


--
-- Name: employee_leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_types (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    annual_quota numeric(5,2),
    carry_forward boolean DEFAULT false,
    max_carry_days integer DEFAULT 0,
    encashable boolean DEFAULT false,
    paid boolean DEFAULT true,
    gender_restrict character varying(10) DEFAULT NULL::character varying,
    min_service_days integer DEFAULT 0,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_leave_types_id_seq OWNED BY public.employee_leave_types.id;


--
-- Name: employee_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_loans (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    loan_type character varying(20) DEFAULT 'advance'::character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    disbursed_date date NOT NULL,
    monthly_emi numeric(10,2) DEFAULT 0 NOT NULL,
    outstanding numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_loans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_loans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_loans_id_seq OWNED BY public.employee_loans.id;


--
-- Name: employee_salary_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_salary_assignments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    salary_structure_id integer NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_salary_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_salary_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_salary_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_salary_assignments_id_seq OWNED BY public.employee_salary_assignments.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    user_id integer,
    employee_code character varying(20),
    name character varying(100) NOT NULL,
    department_id integer,
    designation character varying(100),
    doj date,
    dob date,
    gender character varying(10),
    mobile character varying(15),
    email character varying(150),
    aadhar character varying(20),
    pan character varying(12),
    pf_number character varying(30),
    esic_number character varying(30),
    bank_account character varying(30),
    bank_name character varying(100),
    ifsc character varying(20),
    basic_salary numeric(12,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    middle_name character varying(50),
    father_name character varying(100),
    blood_group character varying(5),
    nationality character varying(30) DEFAULT 'Indian'::character varying,
    marital_status character varying(20),
    permanent_address text,
    current_address text,
    emergency_contact character varying(100),
    emergency_mobile character varying(15),
    photo_url character varying(255),
    employment_type character varying(30) DEFAULT 'Permanent'::character varying,
    grade character varying(20),
    reporting_to integer,
    shift_pattern character varying(20) DEFAULT 'General'::character varying,
    confirmation_date date,
    probation_end date,
    date_of_leaving date,
    separation_type character varying(30),
    uan_number character varying(20),
    gratuity_nomination text,
    is_dept_head boolean DEFAULT false,
    cost_center character varying(30),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    section_id integer,
    hp numeric(8,2),
    amps numeric(8,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    bearing_no_fs character varying(40),
    bearing_no_bs character varying(40)
);


--
-- Name: equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_id_seq OWNED BY public.equipment.id;


--
-- Name: equipment_inspection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_inspection (
    id integer NOT NULL,
    equipment_id integer,
    inspector_id integer,
    status character varying(30) DEFAULT 'Normal'::character varying,
    check_date date DEFAULT CURRENT_DATE NOT NULL,
    next_check_date date,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    fs_status character varying(30),
    bs_status character varying(30),
    shift character varying(10),
    fs_temp numeric(6,2),
    bs_temp numeric(6,2),
    fs_vibration numeric(6,2),
    bs_vibration numeric(6,2),
    fs_number character varying(50),
    bs_number character varying(50),
    CONSTRAINT equipment_inspection_bs_status_check CHECK (((bs_status)::text = ANY (ARRAY[('Normal'::character varying)::text, ('Needs Attention'::character varying)::text, ('Critical'::character varying)::text]))),
    CONSTRAINT equipment_inspection_fs_status_check CHECK (((fs_status)::text = ANY (ARRAY[('Normal'::character varying)::text, ('Needs Attention'::character varying)::text, ('Critical'::character varying)::text]))),
    CONSTRAINT equipment_inspection_shift_check CHECK (((shift)::text = ANY (ARRAY[('Day'::character varying)::text, ('Night'::character varying)::text]))),
    CONSTRAINT equipment_inspection_status_check CHECK (((status)::text = ANY (ARRAY[('Normal'::character varying)::text, ('Needs Attention'::character varying)::text, ('Critical'::character varying)::text])))
);


--
-- Name: equipment_inspection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_inspection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_inspection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_inspection_id_seq OWNED BY public.equipment_inspection.id;


--
-- Name: etp_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etp_readings (
    id integer NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    reading_time time without time zone NOT NULL,
    ph numeric(4,2),
    cod numeric(8,2),
    bod numeric(8,2),
    tss numeric(8,2),
    tds numeric(8,2),
    flow_rate numeric(8,2),
    logged_by integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: etp_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.etp_readings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etp_readings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.etp_readings_id_seq OWNED BY public.etp_readings.id;


--
-- Name: furnish_mix_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.furnish_mix_log (
    id integer NOT NULL,
    batch_number character varying(60),
    report_date date NOT NULL,
    machine_id integer,
    shift_type character varying(10),
    local_furnish_kg numeric(14,2) DEFAULT 0,
    occ_furnish_kg numeric(14,2) DEFAULT 0,
    other_furnish_kg numeric(14,2) DEFAULT 0,
    local_lot character varying(60),
    occ_lot character varying(60),
    local_moisture numeric(5,2),
    occ_moisture numeric(5,2),
    prepared_by integer,
    remarks text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: furnish_mix_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.furnish_mix_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: furnish_mix_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.furnish_mix_log_id_seq OWNED BY public.furnish_mix_log.id;


--
-- Name: gate_passes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_passes (
    id integer NOT NULL,
    gp_number character varying(30),
    date date DEFAULT CURRENT_DATE NOT NULL,
    pass_type character varying(20) NOT NULL,
    vehicle_type character varying(30),
    vehicle_number character varying(20),
    driver_name character varying(100),
    purpose character varying(100),
    material_description text,
    from_party character varying(100),
    to_party character varying(100),
    in_time timestamp without time zone,
    out_time timestamp without time zone,
    weight_in numeric(10,3),
    weight_out numeric(10,3),
    net_weight numeric(10,3),
    security_guard_id integer,
    status character varying(20) DEFAULT 'Open'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: gate_passes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_passes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_passes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_passes_id_seq OWNED BY public.gate_passes.id;


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    gsm_min numeric(6,2),
    gsm_max numeric(6,2),
    description text,
    is_active boolean DEFAULT true,
    deleted_by integer
);


--
-- Name: grades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grades_id_seq OWNED BY public.grades.id;


--
-- Name: grn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grn (
    id integer NOT NULL,
    grn_number character varying(30) NOT NULL,
    date date NOT NULL,
    vendor_id integer,
    po_id integer,
    vehicle_number character varying(20),
    challan_number character varying(50),
    invoice_number character varying(50),
    received_by integer,
    status character varying(20) DEFAULT 'Draft'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT grn_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Received'::character varying)::text, ('QC Pending'::character varying)::text, ('QC Done'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text])))
);


--
-- Name: grn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grn_id_seq OWNED BY public.grn.id;


--
-- Name: grn_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grn_items (
    id integer NOT NULL,
    grn_id integer,
    material_id integer,
    po_qty numeric(12,3),
    received_qty numeric(12,3),
    accepted_qty numeric(12,3),
    rejected_qty numeric(12,3) DEFAULT 0,
    uom character varying(20),
    unit_price numeric(12,2),
    batch_number character varying(50),
    mfg_date date,
    expiry_date date,
    bin_location character varying(30),
    remarks text
);


--
-- Name: grn_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grn_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grn_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grn_items_id_seq OWNED BY public.grn_items.id;


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id integer NOT NULL,
    holiday_date date NOT NULL,
    name character varying(100) NOT NULL,
    holiday_type character varying(20) DEFAULT 'National'::character varying NOT NULL,
    year integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;


--
-- Name: indent_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indent_audit_log (
    id integer NOT NULL,
    indent_id integer NOT NULL,
    action character varying(50) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    user_id integer,
    remarks text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: indent_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.indent_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: indent_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.indent_audit_log_id_seq OWNED BY public.indent_audit_log.id;


--
-- Name: indent_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indent_comments (
    id integer NOT NULL,
    issue_id integer,
    user_id integer,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: indent_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.indent_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: indent_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.indent_comments_id_seq OWNED BY public.indent_comments.id;


--
-- Name: indent_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indent_items (
    id integer NOT NULL,
    indent_id integer,
    material_id integer,
    required_qty numeric(12,3),
    approved_qty numeric(12,3),
    uom character varying(20),
    purpose text,
    current_stock numeric(12,3),
    component_position character varying(200),
    section_id integer,
    machine_id integer,
    unit_price numeric(10,2) DEFAULT 0,
    line_value numeric(12,2) DEFAULT 0,
    issued_qty numeric(10,3) DEFAULT 0,
    batch_no character varying(100),
    reason_code character varying(50),
    ack_by integer,
    ack_at timestamp with time zone,
    fitment_date date,
    observations text,
    kpi_before character varying(100),
    kpi_after character varying(100),
    photo_url character varying(500),
    ack_status character varying(20) DEFAULT 'pending'::character varying
);


--
-- Name: indent_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.indent_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: indent_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.indent_items_id_seq OWNED BY public.indent_items.id;


--
-- Name: indents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indents (
    id integer NOT NULL,
    indent_number character varying(30) NOT NULL,
    date date NOT NULL,
    department_id integer,
    required_date date,
    priority character varying(10) DEFAULT 'Normal'::character varying,
    status character varying(20) DEFAULT 'Draft'::character varying,
    raised_by integer,
    l1_approved_by integer,
    l1_approved_at timestamp without time zone,
    l2_approved_by integer,
    l2_approved_at timestamp without time zone,
    l3_approved_by integer,
    l3_approved_at timestamp without time zone,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    section_id integer,
    machine_id integer,
    total_value numeric(12,2) DEFAULT 0,
    issued_by integer,
    issued_at timestamp with time zone,
    closed_at timestamp with time zone,
    escalated boolean DEFAULT false,
    CONSTRAINT indents_priority_check CHECK (((priority)::text = ANY (ARRAY[('Low'::character varying)::text, ('Normal'::character varying)::text, ('High'::character varying)::text, ('Urgent'::character varying)::text]))),
    CONSTRAINT indents_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Submitted'::character varying)::text, ('L1 Approved'::character varying)::text, ('L2 Approved'::character varying)::text, ('L3 Approved'::character varying)::text, ('PO Created'::character varying)::text, ('Rejected'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: indents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.indents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: indents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.indents_id_seq OWNED BY public.indents.id;


--
-- Name: inspection_round_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_round_scans (
    id integer NOT NULL,
    section_id integer NOT NULL,
    shift character varying(10),
    check_date date DEFAULT CURRENT_DATE NOT NULL,
    file_url character varying(255) NOT NULL,
    original_name character varying(255),
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT now()
);


--
-- Name: inspection_round_scans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_round_scans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_round_scans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_round_scans_id_seq OWNED BY public.inspection_round_scans.id;


--
-- Name: installed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installed_assets (
    id integer NOT NULL,
    asset_number character varying(30),
    material_id integer,
    serial_number character varying(100),
    batch_number character varying(100),
    machine_id integer,
    position_id integer,
    indent_id integer,
    grn_item_id integer,
    requested_by integer,
    approved_by integer,
    issued_by integer,
    purchase_price numeric(12,2) DEFAULT 0.00,
    installed_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'In Service'::character varying,
    retired_at timestamp without time zone,
    failure_reason text,
    expected_lifespan_days integer DEFAULT 365
);


--
-- Name: installed_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.installed_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: installed_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.installed_assets_id_seq OWNED BY public.installed_assets.id;


--
-- Name: lab_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_samples (
    id integer NOT NULL,
    sample_number character varying(30),
    date date DEFAULT CURRENT_DATE NOT NULL,
    sample_type character varying(50),
    source_ref character varying(100),
    collected_by integer,
    tested_by integer,
    brightness numeric(6,2),
    opacity numeric(6,2),
    ph_value numeric(5,2),
    ash_content numeric(6,2),
    moisture numeric(6,2),
    cod numeric(10,3),
    bod numeric(10,3),
    tss numeric(10,3),
    ph_water numeric(5,2),
    concentration numeric(10,3),
    purity numeric(6,2),
    result character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: lab_samples_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lab_samples_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lab_samples_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lab_samples_id_seq OWNED BY public.lab_samples.id;


--
-- Name: leave_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_applications (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    days numeric(5,2) NOT NULL,
    half_day boolean DEFAULT false,
    reason text,
    status character varying(20) DEFAULT 'Pending'::character varying,
    applied_on timestamp with time zone DEFAULT now(),
    approved_by integer,
    approved_on timestamp with time zone,
    rejection_reason text,
    document_url text,
    balance_before numeric(6,2),
    balance_after numeric(6,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_applications_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Cancelled'::character varying)::text, ('Revoked'::character varying)::text])))
);


--
-- Name: leave_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_applications_id_seq OWNED BY public.leave_applications.id;


--
-- Name: machine_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_events (
    id bigint NOT NULL,
    section_id integer,
    equipment_id integer,
    event_type character varying(30) NOT NULL,
    severity character varying(10) DEFAULT 'Warning'::character varying NOT NULL,
    event_time timestamp without time zone DEFAULT now() NOT NULL,
    duration_min numeric(7,2),
    resumed_at timestamp without time zone,
    root_cause_code character varying(50),
    location_detail character varying(100),
    description text,
    downtime_entry_id integer,
    alarm_id integer,
    reported_by integer,
    resolved_by integer,
    resolution_note text,
    kafka_published boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT machine_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('paper_break'::character varying)::text, ('web_wrap'::character varying)::text, ('emergency_stop'::character varying)::text, ('roll_change'::character varying)::text, ('chemical_alarm'::character varying)::text, ('instrument_fault'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT machine_events_severity_check CHECK (((severity)::text = ANY (ARRAY[('Critical'::character varying)::text, ('Warning'::character varying)::text, ('Info'::character varying)::text])))
);


--
-- Name: machine_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machine_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machine_events_id_seq OWNED BY public.machine_events.id;


--
-- Name: machine_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_positions (
    id integer NOT NULL,
    machine_id integer,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: machine_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machine_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machine_positions_id_seq OWNED BY public.machine_positions.id;


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    type character varying(50),
    capacity_tpd numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    ideal_speed_mpm numeric(8,2) DEFAULT 0,
    design_speed_mpm numeric(8,2) DEFAULT 300.00,
    deleted_by integer
);


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: maintenance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_logs (
    id integer NOT NULL,
    schedule_id integer,
    machine_id integer,
    date date NOT NULL,
    maintenance_type character varying(30),
    description text,
    work_done text,
    spare_parts_used jsonb DEFAULT '[]'::jsonb,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_hours numeric(5,2),
    cost numeric(12,2),
    performed_by integer,
    status character varying(20) DEFAULT 'Completed'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_logs_id_seq OWNED BY public.maintenance_logs.id;


--
-- Name: maintenance_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedule (
    id integer NOT NULL,
    machine_id integer,
    maintenance_type character varying(30) NOT NULL,
    title character varying(200) NOT NULL,
    frequency_days integer,
    last_done date,
    next_due date,
    estimated_hours numeric(5,2),
    assigned_to integer,
    status character varying(20) DEFAULT 'Scheduled'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    position_id integer,
    materials_needed text,
    priority character varying(10) DEFAULT 'Medium'::character varying,
    CONSTRAINT maintenance_schedule_status_check CHECK (((status)::text = ANY (ARRAY[('Scheduled'::character varying)::text, ('In Progress'::character varying)::text, ('Done'::character varying)::text, ('Overdue'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: maintenance_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_schedule_id_seq OWNED BY public.maintenance_schedule.id;


--
-- Name: material_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    type character varying(30)
);


--
-- Name: material_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.material_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: material_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.material_categories_id_seq OWNED BY public.material_categories.id;


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(500) NOT NULL,
    category_id integer,
    uom character varying(20) NOT NULL,
    hsn_code character varying(20),
    reorder_level numeric(12,3) DEFAULT 0,
    min_stock numeric(12,3) DEFAULT 0,
    max_stock numeric(12,3) DEFAULT 0,
    current_stock numeric(12,3) DEFAULT 0,
    unit_price numeric(12,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    is_serialized boolean DEFAULT false,
    expected_lifespan_days integer DEFAULT 365,
    section_context character varying(120),
    criticality_class character varying(5),
    procurement_strategy character varying(200),
    oem_supplier character varying(250),
    last_audit_cycle character varying(80),
    calibration_protocol character varying(300),
    reorder_buffer numeric(10,2) DEFAULT 0,
    deleted_by integer,
    bin_location character varying(30),
    CONSTRAINT materials_criticality_class_check CHECK (((criticality_class)::text = ANY (ARRAY[('A'::character varying)::text, ('B'::character varying)::text, ('C'::character varying)::text])))
);


--
-- Name: materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materials_id_seq OWNED BY public.materials.id;


--
-- Name: motor_electrical_specs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motor_electrical_specs (
    id integer NOT NULL,
    sr_no integer,
    motor_name character varying(150) NOT NULL,
    kw numeric(8,2),
    hp numeric(8,2),
    rpm integer,
    full_amp numeric(8,2),
    bearing_no_fs character varying(40),
    bearing_no_bs character varying(40),
    section_label character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: motor_electrical_specs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motor_electrical_specs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motor_electrical_specs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.motor_electrical_specs_id_seq OWNED BY public.motor_electrical_specs.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying,
    title character varying(200) NOT NULL,
    message text,
    ref_table character varying(50),
    ref_id integer,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: onboarding_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_checklist (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    task_id integer NOT NULL,
    due_date date,
    status character varying(20) DEFAULT 'Pending'::character varying,
    completed_by integer,
    completed_on timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_checklist_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('In Progress'::character varying)::text, ('Done'::character varying)::text, ('NA'::character varying)::text])))
);


--
-- Name: onboarding_checklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.onboarding_checklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: onboarding_checklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.onboarding_checklist_id_seq OWNED BY public.onboarding_checklist.id;


--
-- Name: onboarding_tasks_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tasks_master (
    id integer NOT NULL,
    task_title character varying(200) NOT NULL,
    responsible character varying(50) DEFAULT 'HR'::character varying,
    dept_code character varying(20),
    due_days integer DEFAULT 1,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0
);


--
-- Name: onboarding_tasks_master_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.onboarding_tasks_master_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: onboarding_tasks_master_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.onboarding_tasks_master_id_seq OWNED BY public.onboarding_tasks_master.id;


--
-- Name: packing_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packing_records (
    id integer NOT NULL,
    pack_number character varying(30),
    date date DEFAULT CURRENT_DATE NOT NULL,
    reel_id integer,
    packing_type character varying(50),
    wrap_material character varying(50),
    net_weight_kg numeric(10,3),
    gross_weight_kg numeric(10,3),
    label_printed boolean DEFAULT false,
    packed_by integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: packing_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.packing_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: packing_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.packing_records_id_seq OWNED BY public.packing_records.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    payment_number character varying(30),
    sales_order_id integer,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_mode character varying(30) NOT NULL,
    reference_number character varying(100),
    recorded_by integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    confirmed_by integer,
    confirmed_at timestamp without time zone,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Confirmed'::character varying)::text])))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: payroll_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_details (
    id integer NOT NULL,
    payroll_run_id integer NOT NULL,
    employee_id integer NOT NULL,
    salary_structure_id integer,
    working_days integer DEFAULT 26,
    present_days integer,
    lop_days integer DEFAULT 0,
    basic numeric(12,2) DEFAULT 0,
    hra numeric(12,2) DEFAULT 0,
    da numeric(12,2) DEFAULT 0,
    conveyance numeric(12,2) DEFAULT 0,
    medical numeric(12,2) DEFAULT 0,
    special_allowance numeric(12,2) DEFAULT 0,
    overtime_amount numeric(12,2) DEFAULT 0,
    other_earnings numeric(12,2) DEFAULT 0,
    gross_salary numeric(12,2) DEFAULT 0,
    pf_employee numeric(12,2) DEFAULT 0,
    pf_employer numeric(12,2) DEFAULT 0,
    esic_employee numeric(12,2) DEFAULT 0,
    esic_employer numeric(12,2) DEFAULT 0,
    professional_tax numeric(12,2) DEFAULT 0,
    tds numeric(12,2) DEFAULT 0,
    advance_recovery numeric(12,2) DEFAULT 0,
    loan_recovery numeric(12,2) DEFAULT 0,
    other_deductions numeric(12,2) DEFAULT 0,
    total_deductions numeric(12,2) DEFAULT 0,
    net_salary numeric(12,2) DEFAULT 0,
    payment_mode character varying(20) DEFAULT 'Bank'::character varying,
    payment_status character varying(20) DEFAULT 'Draft'::character varying,
    payment_date date,
    transaction_ref character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_details_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Approved'::character varying)::text, ('Paid'::character varying)::text])))
);


--
-- Name: payroll_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_details_id_seq OWNED BY public.payroll_details.id;


--
-- Name: payroll_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_runs (
    id integer NOT NULL,
    month date NOT NULL,
    status character varying(20) DEFAULT 'Draft'::character varying,
    total_employees integer,
    total_gross numeric(14,2),
    total_deductions numeric(14,2),
    total_net numeric(14,2),
    generated_by integer,
    approved_by integer,
    paid_by integer,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_runs_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Processing'::character varying)::text, ('Approved'::character varying)::text, ('Paid'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_runs_id_seq OWNED BY public.payroll_runs.id;


--
-- Name: payrolls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payrolls (
    id integer NOT NULL,
    employee_id integer,
    month character varying(7) NOT NULL,
    present_days integer DEFAULT 0,
    basic_salary numeric(12,2) NOT NULL,
    allowances numeric(12,2) DEFAULT 0.00,
    deductions numeric(12,2) DEFAULT 0.00,
    net_salary numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'Draft'::character varying,
    paid_date date,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: payrolls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payrolls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payrolls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payrolls_id_seq OWNED BY public.payrolls.id;


--
-- Name: plant_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_sections (
    id integer NOT NULL,
    section_code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(10),
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    department_id integer
);


--
-- Name: plant_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plant_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plant_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plant_sections_id_seq OWNED BY public.plant_sections.id;


--
-- Name: po_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.po_items (
    id integer NOT NULL,
    po_id integer,
    material_id integer,
    qty numeric(12,3),
    received_qty numeric(12,3) DEFAULT 0,
    uom character varying(20),
    unit_price numeric(12,2),
    gst_pct numeric(5,2),
    total numeric(15,2)
);


--
-- Name: po_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.po_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: po_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.po_items_id_seq OWNED BY public.po_items.id;


--
-- Name: production_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_summary (
    id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(10) NOT NULL,
    machine_id integer,
    total_reels integer DEFAULT 0,
    total_production_kg numeric(12,3) DEFAULT 0,
    total_reject_kg numeric(12,3) DEFAULT 0,
    net_production_kg numeric(12,3) DEFAULT 0,
    avg_gsm numeric(6,2),
    avg_moisture numeric(5,2),
    avg_speed numeric(8,2),
    avg_efficiency numeric(5,2),
    total_downtime_min integer DEFAULT 0,
    total_steam numeric(12,2) DEFAULT 0,
    total_water numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: production_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_summary_id_seq OWNED BY public.production_summary.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    po_number character varying(30) NOT NULL,
    date date NOT NULL,
    vendor_id integer,
    indent_id integer,
    delivery_date date,
    payment_terms character varying(50),
    status character varying(20) DEFAULT 'Draft'::character varying,
    total_value numeric(15,2),
    gst_value numeric(12,2),
    grand_total numeric(15,2),
    approved_by integer,
    created_by integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY (ARRAY[('Draft'::character varying)::text, ('Approved'::character varying)::text, ('Sent'::character varying)::text, ('Partial'::character varying)::text, ('Received'::character varying)::text, ('Closed'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: quality_lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_lab_tests (
    id bigint NOT NULL,
    reel_id integer,
    section_id integer,
    shift_id integer,
    test_time timestamp without time zone DEFAULT now() NOT NULL,
    freeness_csf numeric(7,2),
    consistency_pct numeric(5,3),
    basis_weight_gsm numeric(7,3),
    burst_factor numeric(6,2),
    moisture_pct numeric(5,2),
    tensile_md numeric(8,2),
    tensile_cd numeric(8,2),
    cobb_size numeric(7,3),
    dirt_count numeric(8,3),
    trim_loss_mm numeric(7,2),
    slit_count smallint,
    lab_by integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: quality_lab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_lab_tests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_lab_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_lab_tests_id_seq OWNED BY public.quality_lab_tests.id;


--
-- Name: quality_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_tests (
    id integer NOT NULL,
    test_number character varying(30) NOT NULL,
    test_type character varying(30) NOT NULL,
    reference_type character varying(30),
    reference_id integer,
    tested_by integer,
    test_date timestamp without time zone DEFAULT now(),
    gsm numeric(6,2),
    moisture_pct numeric(5,2),
    caliper_micron numeric(8,2),
    burst_factor numeric(8,2),
    cobb_value numeric(8,2),
    brightness_pct numeric(5,2),
    thickness_micron numeric(8,2),
    width_mm numeric(8,2),
    weight_kg numeric(10,3),
    tensile_strength numeric(8,2),
    tear_strength numeric(8,2),
    result character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT quality_tests_result_check CHECK (((result)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Pass'::character varying)::text, ('Fail'::character varying)::text, ('Hold'::character varying)::text])))
);


--
-- Name: quality_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quality_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quality_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quality_tests_id_seq OWNED BY public.quality_tests.id;


--
-- Name: reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reels (
    id integer NOT NULL,
    reel_number character varying(50) NOT NULL,
    barcode character varying(100),
    shift_id integer,
    machine_id integer,
    grade_id integer,
    operator_id integer,
    gsm numeric(6,2),
    width_mm numeric(8,2),
    length_m numeric(10,2),
    weight_kg numeric(10,3),
    moisture_pct numeric(5,2),
    speed_mpm numeric(8,2),
    steam_pressure numeric(8,2),
    steam_consumption numeric(10,2),
    water_consumption numeric(10,2),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    production_time_min integer,
    break_time_min integer DEFAULT 0,
    downtime_min integer DEFAULT 0,
    efficiency_pct numeric(5,2),
    reject_pct numeric(5,2),
    quality_status character varying(20) DEFAULT 'Pending'::character varying,
    sales_order_id integer,
    rack_location character varying(50),
    status character varying(30) DEFAULT 'In Production'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    bf integer,
    deckle numeric(8,2),
    reject_reason text,
    CONSTRAINT reels_quality_status_check CHECK (((quality_status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT reels_status_check CHECK (((status)::text = ANY (ARRAY[('In Production'::character varying)::text, ('QC Pending'::character varying)::text, ('QC Done'::character varying)::text, ('In Warehouse'::character varying)::text, ('Dispatched'::character varying)::text, ('Rejected'::character varying)::text])))
);


--
-- Name: reels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reels_id_seq OWNED BY public.reels.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    level integer NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: salary_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_structures (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    grade character varying(20),
    basic_pct numeric(5,2) DEFAULT 100,
    hra_pct numeric(5,2) DEFAULT 40,
    da_pct numeric(5,2) DEFAULT 20,
    conv_fixed numeric(10,2) DEFAULT 1600,
    medical_fixed numeric(10,2) DEFAULT 1250,
    special_pct numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: salary_structures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salary_structures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salary_structures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salary_structures_id_seq OWNED BY public.salary_structures.id;


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id integer NOT NULL,
    so_number character varying(30) NOT NULL,
    date date NOT NULL,
    customer_id integer,
    delivery_date date,
    grade_id integer,
    gsm numeric(6,2),
    width_mm numeric(8,2),
    qty_mt numeric(12,3),
    fulfilled_mt numeric(12,3) DEFAULT 0,
    rate_per_kg numeric(10,2),
    total_value numeric(15,2),
    status character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT sales_orders_status_check CHECK (((status)::text = ANY (ARRAY[('Pending'::character varying)::text, ('In Production'::character varying)::text, ('Ready'::character varying)::text, ('Partial'::character varying)::text, ('Dispatched'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: sales_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_orders_id_seq OWNED BY public.sales_orders.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp without time zone DEFAULT now()
);


--
-- Name: scrap_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrap_records (
    id integer NOT NULL,
    scrap_number character varying(30),
    date date DEFAULT CURRENT_DATE NOT NULL,
    scrap_type character varying(50),
    source_department_id integer,
    quantity_kg numeric(12,3) NOT NULL,
    description text,
    disposal_method character varying(50),
    buyer_name character varying(100),
    sale_amount numeric(12,2) DEFAULT 0,
    recorded_by integer,
    status character varying(20) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    remarks text
);


--
-- Name: scrap_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scrap_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scrap_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scrap_records_id_seq OWNED BY public.scrap_records.id;


--
-- Name: section_alarms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_alarms (
    id integer NOT NULL,
    section_id integer,
    equipment_id integer,
    tag_name character varying(50),
    alarm_code character varying(30),
    alarm_type character varying(20) NOT NULL,
    description text NOT NULL,
    triggered_at timestamp without time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp without time zone,
    acknowledged_by integer,
    resolved_at timestamp without time zone,
    resolution_note text,
    maintenance_log_id integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT section_alarms_alarm_type_check CHECK (((alarm_type)::text = ANY (ARRAY[('Critical'::character varying)::text, ('Warning'::character varying)::text, ('Info'::character varying)::text])))
);


--
-- Name: section_alarms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_alarms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_alarms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_alarms_id_seq OWNED BY public.section_alarms.id;


--
-- Name: section_energy_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_energy_allocations (
    id integer NOT NULL,
    allocated_date date NOT NULL,
    section_id integer,
    power_kwh numeric(12,2) DEFAULT 0,
    steam_mt numeric(10,2) DEFAULT 0,
    water_kl numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: section_energy_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_energy_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_energy_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_energy_allocations_id_seq OWNED BY public.section_energy_allocations.id;


--
-- Name: section_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_equipment (
    id integer NOT NULL,
    section_id integer,
    machine_id integer,
    tag_name character varying(50) NOT NULL,
    equipment_name character varying(150) NOT NULL,
    equipment_type character varying(50),
    manufacturer character varying(100),
    model_number character varying(100),
    serial_number character varying(100),
    installation_date date,
    rated_capacity character varying(50),
    design_pressure character varying(30),
    design_temp character varying(30),
    motor_kw numeric(8,2),
    rpm integer,
    is_critical boolean DEFAULT false,
    is_active boolean DEFAULT true,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: section_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_equipment_id_seq OWNED BY public.section_equipment.id;


--
-- Name: section_kpi_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_kpi_snapshots (
    id integer NOT NULL,
    section_id integer,
    snapshot_time timestamp without time zone NOT NULL,
    kpi_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: section_kpi_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_kpi_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_kpi_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_kpi_snapshots_id_seq OWNED BY public.section_kpi_snapshots.id;


--
-- Name: section_process_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_process_readings (
    id bigint NOT NULL,
    section_id integer,
    equipment_id integer,
    tag_name character varying(50) NOT NULL,
    parameter_name character varying(100) NOT NULL,
    value numeric(12,4),
    uom character varying(20),
    reading_time timestamp without time zone DEFAULT now() NOT NULL,
    shift_id integer,
    recorded_by integer,
    source character varying(20) DEFAULT 'Manual'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT section_process_readings_source_check CHECK (((source)::text = ANY (ARRAY[('Manual'::character varying)::text, ('SCADA'::character varying)::text, ('Auto'::character varying)::text])))
);


--
-- Name: section_process_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_process_readings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_process_readings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_process_readings_id_seq OWNED BY public.section_process_readings.id;


--
-- Name: section_sops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_sops (
    id integer NOT NULL,
    section_id integer,
    sop_type character varying(30) NOT NULL,
    title character varying(200) NOT NULL,
    version character varying(10) DEFAULT '1.0'::character varying,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    approved_by integer,
    approved_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT section_sops_sop_type_check CHECK (((sop_type)::text = ANY (ARRAY[('Startup'::character varying)::text, ('Shutdown'::character varying)::text, ('Emergency'::character varying)::text, ('Changeover'::character varying)::text, ('Cleaning'::character varying)::text])))
);


--
-- Name: section_sops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_sops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_sops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_sops_id_seq OWNED BY public.section_sops.id;


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    department_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sections_id_seq OWNED BY public.sections.id;


--
-- Name: separation_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.separation_records (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    separation_type character varying(30) NOT NULL,
    resignation_date date,
    last_working_date date,
    notice_period_days integer,
    notice_served_days integer,
    notice_buyout boolean DEFAULT false,
    reason text,
    status character varying(20) DEFAULT 'Initiated'::character varying,
    service_years numeric(5,2),
    gratuity_amount numeric(12,2),
    leave_encashment numeric(12,2),
    bonus_payable numeric(12,2),
    deductions numeric(12,2),
    net_ff_amount numeric(12,2),
    ff_paid_date date,
    initiated_by integer,
    approved_by integer,
    closed_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT separation_records_separation_type_check CHECK (((separation_type)::text = ANY (ARRAY[('Resignation'::character varying)::text, ('Termination'::character varying)::text, ('Retirement'::character varying)::text, ('Absconding'::character varying)::text, ('Contract End'::character varying)::text, ('Death'::character varying)::text]))),
    CONSTRAINT separation_records_status_check CHECK (((status)::text = ANY (ARRAY[('Initiated'::character varying)::text, ('Clearance Pending'::character varying)::text, ('FF Pending'::character varying)::text, ('Completed'::character varying)::text, ('Revoked'::character varying)::text])))
);


--
-- Name: separation_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.separation_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: separation_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.separation_records_id_seq OWNED BY public.separation_records.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(128) NOT NULL,
    user_id integer,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: shift_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_reports (
    id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(10) NOT NULL,
    section character varying(50) NOT NULL,
    operator_id integer,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT shift_reports_shift_type_check CHECK (((shift_type)::text = ANY (ARRAY[('Day'::character varying)::text, ('Night'::character varying)::text])))
);


--
-- Name: shift_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_reports_id_seq OWNED BY public.shift_reports.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(10) NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    supervisor_id integer,
    machine_id integer,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'Open'::character varying,
    CONSTRAINT shifts_shift_type_check CHECK (((shift_type)::text = ANY (ARRAY[('Day'::character varying)::text, ('Night'::character varying)::text, ('General'::character varying)::text]))),
    CONSTRAINT shifts_status_check CHECK (((status)::text = ANY (ARRAY[('Open'::character varying)::text, ('Closed'::character varying)::text])))
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_ledger (
    id integer NOT NULL,
    material_id integer,
    date date NOT NULL,
    transaction_type character varying(30) NOT NULL,
    reference_id integer,
    reference_type character varying(30),
    in_qty numeric(12,3) DEFAULT 0,
    out_qty numeric(12,3) DEFAULT 0,
    balance numeric(12,3) NOT NULL,
    unit_price numeric(12,2),
    value numeric(15,2),
    batch_number character varying(50),
    bin_location character varying(30),
    remarks text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    shift character varying(10),
    is_high_txn boolean DEFAULT false,
    CONSTRAINT stock_ledger_shift_check CHECK (((shift)::text = ANY (ARRAY[('Day'::character varying)::text, ('Night'::character varying)::text])))
);


--
-- Name: stock_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_ledger_id_seq OWNED BY public.stock_ledger.id;


--
-- Name: store_indent_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_indent_log (
    id integer NOT NULL,
    indent_id integer,
    action character varying(30),
    from_status character varying(20),
    to_status character varying(20),
    actor_id integer,
    actor_name character varying(100),
    actor_role character varying(50),
    qty numeric(12,3),
    note text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: store_indent_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_indent_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: store_indent_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_indent_log_id_seq OWNED BY public.store_indent_log.id;


--
-- Name: store_indents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_indents (
    id integer NOT NULL,
    indent_number character varying(30),
    indent_date date DEFAULT CURRENT_DATE NOT NULL,
    department_id integer,
    material_id integer,
    qty_requested numeric(12,3) NOT NULL,
    qty_issued numeric(12,3) DEFAULT 0,
    unit character varying(20),
    purpose text,
    priority character varying(20) DEFAULT 'Normal'::character varying,
    status character varying(20) DEFAULT 'Requested'::character varying,
    requested_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    issued_by integer,
    issued_at timestamp without time zone,
    closed_by integer,
    closed_at timestamp without time zone,
    reject_reason text,
    remarks text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: store_indents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_indents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: store_indents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_indents_id_seq OWNED BY public.store_indents.id;


--
-- Name: store_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_issues (
    id integer NOT NULL,
    issue_number character varying(30),
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    material_id integer,
    department_id integer,
    quantity numeric(12,3) NOT NULL,
    unit character varying(20),
    purpose text,
    issued_by integer,
    approved_by integer,
    status character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    indent_type character varying(30) DEFAULT 'Consumable'::character varying,
    machine_id integer,
    position_id integer,
    justification text,
    estimated_value numeric(12,2) DEFAULT 0.00,
    required_by_date date DEFAULT CURRENT_DATE,
    issue_option character varying(20) DEFAULT 'full'::character varying,
    substitute_material_id integer,
    serial_number character varying(100),
    batch_number character varying(100),
    acknowledged_at timestamp without time zone,
    acknowledged_by integer
);


--
-- Name: store_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: store_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_issues_id_seq OWNED BY public.store_issues.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    category character varying(50),
    label character varying(100),
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: training_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_attendance (
    id integer NOT NULL,
    training_id integer NOT NULL,
    employee_id integer NOT NULL,
    nominated_by integer,
    status character varying(20) DEFAULT 'Nominated'::character varying,
    feedback text,
    score numeric(5,2),
    certificate_url text,
    attended_on date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT training_attendance_status_check CHECK (((status)::text = ANY (ARRAY[('Nominated'::character varying)::text, ('Attended'::character varying)::text, ('Absent'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: training_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_attendance_id_seq OWNED BY public.training_attendance.id;


--
-- Name: training_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_programs (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    category character varying(50),
    trainer_name character varying(100),
    trainer_type character varying(20) DEFAULT 'Internal'::character varying,
    venue character varying(200),
    scheduled_date date,
    duration_hours numeric(5,2),
    max_nominees integer,
    department_ids integer[],
    status character varying(20) DEFAULT 'Planned'::character varying,
    notes text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT training_programs_status_check CHECK (((status)::text = ANY (ARRAY[('Planned'::character varying)::text, ('Completed'::character varying)::text, ('Cancelled'::character varying)::text]))),
    CONSTRAINT training_programs_trainer_type_check CHECK (((trainer_type)::text = ANY (ARRAY[('Internal'::character varying)::text, ('External'::character varying)::text, ('Online'::character varying)::text])))
);


--
-- Name: training_programs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_programs_id_seq OWNED BY public.training_programs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    employee_code character varying(20),
    name character varying(100) NOT NULL,
    email character varying(150),
    mobile character varying(15),
    password_hash character varying(255) NOT NULL,
    role_id integer,
    department_id integer,
    shift character varying(10),
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    must_change_password boolean DEFAULT false
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: utility_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utility_readings (
    id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(10),
    reading_time timestamp without time zone NOT NULL,
    power_units numeric(12,2),
    dg_units numeric(12,2),
    steam_generated_mt numeric(10,3),
    coal_consumed_kg numeric(10,3),
    boiler_pressure numeric(8,2),
    boiler_temp numeric(8,2),
    fresh_water_kl numeric(10,3),
    process_water_kl numeric(10,3),
    air_pressure numeric(8,2),
    etp_inlet_kl numeric(10,3),
    etp_outlet_kl numeric(10,3),
    recorded_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: utility_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.utility_readings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: utility_readings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.utility_readings_id_seq OWNED BY public.utility_readings.id;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id integer NOT NULL,
    code character varying(20),
    name character varying(150) NOT NULL,
    gstin character varying(20),
    pan character varying(12),
    address text,
    city character varying(100),
    state character varying(100),
    pincode character varying(10),
    contact_person character varying(100),
    mobile character varying(15),
    email character varying(150),
    payment_terms character varying(50),
    credit_days integer DEFAULT 30,
    rating numeric(3,1) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    deleted_by integer
);


--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;


--
-- Name: adjustment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_requests ALTER COLUMN id SET DEFAULT nextval('public.adjustment_requests_id_seq'::regclass);


--
-- Name: appraisal_competencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_competencies ALTER COLUMN id SET DEFAULT nextval('public.appraisal_competencies_id_seq'::regclass);


--
-- Name: appraisal_cycles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_cycles ALTER COLUMN id SET DEFAULT nextval('public.appraisal_cycles_id_seq'::regclass);


--
-- Name: appraisal_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_goals ALTER COLUMN id SET DEFAULT nextval('public.appraisal_goals_id_seq'::regclass);


--
-- Name: approval_matrix id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix ALTER COLUMN id SET DEFAULT nextval('public.approval_matrix_id_seq'::regclass);


--
-- Name: asset_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events ALTER COLUMN id SET DEFAULT nextval('public.asset_events_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: attendance_regularization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization ALTER COLUMN id SET DEFAULT nextval('public.attendance_regularization_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: boiler_performance_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boiler_performance_logs ALTER COLUMN id SET DEFAULT nextval('public.boiler_performance_logs_id_seq'::regclass);


--
-- Name: chemical_consumption id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_consumption ALTER COLUMN id SET DEFAULT nextval('public.chemical_consumption_id_seq'::regclass);


--
-- Name: chemical_limit_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_limit_alerts ALTER COLUMN id SET DEFAULT nextval('public.chemical_limit_alerts_id_seq'::regclass);


--
-- Name: clearance_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_items ALTER COLUMN id SET DEFAULT nextval('public.clearance_items_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: daily_production_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports ALTER COLUMN id SET DEFAULT nextval('public.daily_production_reports_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: dispatch_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_items ALTER COLUMN id SET DEFAULT nextval('public.dispatch_items_id_seq'::regclass);


--
-- Name: dispatch_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders ALTER COLUMN id SET DEFAULT nextval('public.dispatch_orders_id_seq'::regclass);


--
-- Name: downtime_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries ALTER COLUMN id SET DEFAULT nextval('public.downtime_entries_id_seq'::regclass);


--
-- Name: downtime_reason_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_reason_codes ALTER COLUMN id SET DEFAULT nextval('public.downtime_reason_codes_id_seq'::regclass);


--
-- Name: dpr_chemical_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_chemical_lines ALTER COLUMN id SET DEFAULT nextval('public.dpr_chemical_lines_id_seq'::regclass);


--
-- Name: dpr_downtime_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_downtime_lines ALTER COLUMN id SET DEFAULT nextval('public.dpr_downtime_lines_id_seq'::regclass);


--
-- Name: dpr_grade_standards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_grade_standards ALTER COLUMN id SET DEFAULT nextval('public.dpr_grade_standards_id_seq'::regclass);


--
-- Name: dpr_gsm_breakup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_gsm_breakup ALTER COLUMN id SET DEFAULT nextval('public.dpr_gsm_breakup_id_seq'::regclass);


--
-- Name: ehs_incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehs_incidents ALTER COLUMN id SET DEFAULT nextval('public.ehs_incidents_id_seq'::regclass);


--
-- Name: employee_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents ALTER COLUMN id SET DEFAULT nextval('public.employee_documents_id_seq'::regclass);


--
-- Name: employee_leave_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances ALTER COLUMN id SET DEFAULT nextval('public.employee_leave_balances_id_seq'::regclass);


--
-- Name: employee_leave_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_types ALTER COLUMN id SET DEFAULT nextval('public.employee_leave_types_id_seq'::regclass);


--
-- Name: employee_loans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans ALTER COLUMN id SET DEFAULT nextval('public.employee_loans_id_seq'::regclass);


--
-- Name: employee_salary_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_assignments ALTER COLUMN id SET DEFAULT nextval('public.employee_salary_assignments_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment ALTER COLUMN id SET DEFAULT nextval('public.equipment_id_seq'::regclass);


--
-- Name: equipment_inspection id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_inspection ALTER COLUMN id SET DEFAULT nextval('public.equipment_inspection_id_seq'::regclass);


--
-- Name: etp_readings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etp_readings ALTER COLUMN id SET DEFAULT nextval('public.etp_readings_id_seq'::regclass);


--
-- Name: furnish_mix_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furnish_mix_log ALTER COLUMN id SET DEFAULT nextval('public.furnish_mix_log_id_seq'::regclass);


--
-- Name: gate_passes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_passes ALTER COLUMN id SET DEFAULT nextval('public.gate_passes_id_seq'::regclass);


--
-- Name: grades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades ALTER COLUMN id SET DEFAULT nextval('public.grades_id_seq'::regclass);


--
-- Name: grn id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn ALTER COLUMN id SET DEFAULT nextval('public.grn_id_seq'::regclass);


--
-- Name: grn_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items ALTER COLUMN id SET DEFAULT nextval('public.grn_items_id_seq'::regclass);


--
-- Name: holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);


--
-- Name: indent_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_audit_log ALTER COLUMN id SET DEFAULT nextval('public.indent_audit_log_id_seq'::regclass);


--
-- Name: indent_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_comments ALTER COLUMN id SET DEFAULT nextval('public.indent_comments_id_seq'::regclass);


--
-- Name: indent_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items ALTER COLUMN id SET DEFAULT nextval('public.indent_items_id_seq'::regclass);


--
-- Name: indents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents ALTER COLUMN id SET DEFAULT nextval('public.indents_id_seq'::regclass);


--
-- Name: inspection_round_scans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_round_scans ALTER COLUMN id SET DEFAULT nextval('public.inspection_round_scans_id_seq'::regclass);


--
-- Name: installed_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets ALTER COLUMN id SET DEFAULT nextval('public.installed_assets_id_seq'::regclass);


--
-- Name: lab_samples id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples ALTER COLUMN id SET DEFAULT nextval('public.lab_samples_id_seq'::regclass);


--
-- Name: leave_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications ALTER COLUMN id SET DEFAULT nextval('public.leave_applications_id_seq'::regclass);


--
-- Name: machine_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events ALTER COLUMN id SET DEFAULT nextval('public.machine_events_id_seq'::regclass);


--
-- Name: machine_positions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_positions ALTER COLUMN id SET DEFAULT nextval('public.machine_positions_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: maintenance_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs ALTER COLUMN id SET DEFAULT nextval('public.maintenance_logs_id_seq'::regclass);


--
-- Name: maintenance_schedule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule ALTER COLUMN id SET DEFAULT nextval('public.maintenance_schedule_id_seq'::regclass);


--
-- Name: material_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories ALTER COLUMN id SET DEFAULT nextval('public.material_categories_id_seq'::regclass);


--
-- Name: materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials ALTER COLUMN id SET DEFAULT nextval('public.materials_id_seq'::regclass);


--
-- Name: motor_electrical_specs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motor_electrical_specs ALTER COLUMN id SET DEFAULT nextval('public.motor_electrical_specs_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: onboarding_checklist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist ALTER COLUMN id SET DEFAULT nextval('public.onboarding_checklist_id_seq'::regclass);


--
-- Name: onboarding_tasks_master id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks_master ALTER COLUMN id SET DEFAULT nextval('public.onboarding_tasks_master_id_seq'::regclass);


--
-- Name: packing_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_records ALTER COLUMN id SET DEFAULT nextval('public.packing_records_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: payroll_details id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details ALTER COLUMN id SET DEFAULT nextval('public.payroll_details_id_seq'::regclass);


--
-- Name: payroll_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs ALTER COLUMN id SET DEFAULT nextval('public.payroll_runs_id_seq'::regclass);


--
-- Name: payrolls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls ALTER COLUMN id SET DEFAULT nextval('public.payrolls_id_seq'::regclass);


--
-- Name: plant_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_sections ALTER COLUMN id SET DEFAULT nextval('public.plant_sections_id_seq'::regclass);


--
-- Name: po_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_items ALTER COLUMN id SET DEFAULT nextval('public.po_items_id_seq'::regclass);


--
-- Name: production_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_summary ALTER COLUMN id SET DEFAULT nextval('public.production_summary_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: quality_lab_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests ALTER COLUMN id SET DEFAULT nextval('public.quality_lab_tests_id_seq'::regclass);


--
-- Name: quality_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_tests ALTER COLUMN id SET DEFAULT nextval('public.quality_tests_id_seq'::regclass);


--
-- Name: reels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels ALTER COLUMN id SET DEFAULT nextval('public.reels_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: salary_structures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_structures ALTER COLUMN id SET DEFAULT nextval('public.salary_structures_id_seq'::regclass);


--
-- Name: sales_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders ALTER COLUMN id SET DEFAULT nextval('public.sales_orders_id_seq'::regclass);


--
-- Name: scrap_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records ALTER COLUMN id SET DEFAULT nextval('public.scrap_records_id_seq'::regclass);


--
-- Name: section_alarms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms ALTER COLUMN id SET DEFAULT nextval('public.section_alarms_id_seq'::regclass);


--
-- Name: section_energy_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_energy_allocations ALTER COLUMN id SET DEFAULT nextval('public.section_energy_allocations_id_seq'::regclass);


--
-- Name: section_equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_equipment ALTER COLUMN id SET DEFAULT nextval('public.section_equipment_id_seq'::regclass);


--
-- Name: section_kpi_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_kpi_snapshots ALTER COLUMN id SET DEFAULT nextval('public.section_kpi_snapshots_id_seq'::regclass);


--
-- Name: section_process_readings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings ALTER COLUMN id SET DEFAULT nextval('public.section_process_readings_id_seq'::regclass);


--
-- Name: section_sops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_sops ALTER COLUMN id SET DEFAULT nextval('public.section_sops_id_seq'::regclass);


--
-- Name: sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections ALTER COLUMN id SET DEFAULT nextval('public.sections_id_seq'::regclass);


--
-- Name: separation_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records ALTER COLUMN id SET DEFAULT nextval('public.separation_records_id_seq'::regclass);


--
-- Name: shift_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_reports ALTER COLUMN id SET DEFAULT nextval('public.shift_reports_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: stock_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger ALTER COLUMN id SET DEFAULT nextval('public.stock_ledger_id_seq'::regclass);


--
-- Name: store_indent_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indent_log ALTER COLUMN id SET DEFAULT nextval('public.store_indent_log_id_seq'::regclass);


--
-- Name: store_indents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents ALTER COLUMN id SET DEFAULT nextval('public.store_indents_id_seq'::regclass);


--
-- Name: store_issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues ALTER COLUMN id SET DEFAULT nextval('public.store_issues_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: training_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance ALTER COLUMN id SET DEFAULT nextval('public.training_attendance_id_seq'::regclass);


--
-- Name: training_programs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs ALTER COLUMN id SET DEFAULT nextval('public.training_programs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: utility_readings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_readings ALTER COLUMN id SET DEFAULT nextval('public.utility_readings_id_seq'::regclass);


--
-- Name: vendors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);


--
-- Data for Name: adjustment_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.adjustment_requests (id, material_id, qty, reason, bin_location, batch_number, status, requested_by, approved_by, approved_at, created_at) FROM stdin;
\.


--
-- Data for Name: appraisal_competencies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appraisal_competencies (id, cycle_id, employee_id, competency, self_rating, manager_rating, comments, created_at) FROM stdin;
\.


--
-- Data for Name: appraisal_cycles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appraisal_cycles (id, name, year, cycle_type, start_date, end_date, goal_set_deadline, self_review_deadline, manager_review_deadline, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: appraisal_goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appraisal_goals (id, cycle_id, employee_id, goal_title, description, weightage, kpi_target, kpi_actual, self_rating, manager_rating, final_rating, set_by, created_at) FROM stdin;
\.


--
-- Data for Name: approval_matrix; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval_matrix (id, tier, label, min_value, max_value, required_level, description) FROM stdin;
1	1	Small	0.00	10000.00	2	Under Rs 10,000 — L1 supervisor only
2	2	Medium	10000.00	100000.00	3	Rs 10k to Rs 1L — L1 + dept head (L2)
3	3	Large	100000.00	\N	4	Above Rs 1L — L1 + dept head + plant head (L3)
\.


--
-- Data for Name: asset_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.asset_events (id, asset_id, event_type, event_date, recorded_by, remarks) FROM stdin;
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance (id, employee_id, date, shift_type, in_time, out_time, hours_worked, status, remarks) FROM stdin;
\.


--
-- Data for Name: attendance_regularization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance_regularization (id, employee_id, attendance_date, in_time, out_time, reason, status, applied_on, approved_by, approved_on, rejection_reason, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, user_id, action, module, record_id, old_data, new_data, ip_address, created_at) FROM stdin;
1	1	UPSERT	production	1	\N	{"report_date": "2026-06-28T18:30:00.000Z"}	::1	2026-07-01 00:19:35.303277
2	1	UPSERT	production	1	\N	{"report_date": "2026-06-28T18:30:00.000Z"}	::1	2026-07-01 00:36:05.279412
3	1	UPSERT	production	3	\N	{"report_date": "2026-06-30T18:30:00.000Z"}	::1	2026-07-01 00:39:24.934901
4	1	UPSERT	production	1	\N	{"report_date": "2026-06-28T18:30:00.000Z"}	::1	2026-07-01 00:42:07.58927
5	1	UPSERT	production	5	\N	{"report_date": "2026-06-30T18:30:00.000Z"}	::1	2026-07-01 00:46:00.358798
6	1	UPSERT	production	6	\N	{"report_date": "2026-07-01T18:30:00.000Z"}	::1	2026-07-05 16:32:40.409582
7	1	REEL_CREATED	Production	31	\N	{"bf": 20, "id": 31, "gsm": "120.00", "deckle": "1820.50", "status": "In Production", "barcode": "MK-MK-20260705-PM1-0001-1783254563771", "remarks": "Integration test reel", "end_time": null, "grade_id": 1, "length_m": "5000.00", "shift_id": null, "width_mm": "1800.00", "speed_mpm": null, "weight_kg": "950.500", "created_at": "2026-07-05T12:29:23.767Z", "machine_id": 1, "reject_pct": null, "start_time": null, "updated_at": "2026-07-05T12:29:23.767Z", "operator_id": 1, "reel_number": "MK-20260705-PM1-0001", "downtime_min": null, "moisture_pct": "6.80", "rack_location": null, "reject_reason": null, "break_time_min": null, "efficiency_pct": "100.00", "quality_status": "Pending", "sales_order_id": null, "steam_pressure": null, "steam_consumption": null, "water_consumption": null, "production_time_min": 45}	::1	2026-07-05 17:59:23.767087
8	1	DOWNTIME_LOGGED	Production	7	\N	{"id": 7, "reason": "Vacuum box bolt broken/cracked - test remarks", "reel_id": null, "category": "Mechanical", "end_time": "2026-07-05T07:14:23.790Z", "shift_id": null, "created_at": "2026-07-05T12:29:23.793Z", "machine_id": 1, "start_time": "2026-07-05T06:59:23.789Z", "reported_by": 1, "duration_min": 15, "reason_code_id": 1, "corrective_action": "Replaced bolt"}	::1	2026-07-05 17:59:23.793027
9	1	REEL_CREATED	Production	32	\N	{"bf": 20, "id": 32, "gsm": "120.00", "deckle": "1820.50", "status": "In Production", "barcode": "MK-MK-20260705-PM1-0002-1783254578452", "remarks": "Integration test reel", "end_time": null, "grade_id": 1, "length_m": "5000.00", "shift_id": null, "width_mm": "1800.00", "speed_mpm": null, "weight_kg": "950.500", "created_at": "2026-07-05T12:29:38.452Z", "machine_id": 1, "reject_pct": null, "start_time": null, "updated_at": "2026-07-05T12:29:38.452Z", "operator_id": 1, "reel_number": "MK-20260705-PM1-0002", "downtime_min": null, "moisture_pct": "6.80", "rack_location": null, "reject_reason": null, "break_time_min": null, "efficiency_pct": "100.00", "quality_status": "Pending", "sales_order_id": null, "steam_pressure": null, "steam_consumption": null, "water_consumption": null, "production_time_min": 45}	::1	2026-07-05 17:59:38.452653
10	1	DOWNTIME_LOGGED	Production	8	\N	{"id": 8, "reason": "Vacuum box bolt broken/cracked - test remarks", "reel_id": null, "category": "Mechanical", "end_time": "2026-07-05T07:14:38.463Z", "shift_id": null, "created_at": "2026-07-05T12:29:38.465Z", "machine_id": 1, "start_time": "2026-07-05T06:59:38.462Z", "reported_by": 1, "duration_min": 15, "reason_code_id": 1, "corrective_action": "Replaced bolt"}	::1	2026-07-05 17:59:38.4656
11	1	REEL_CREATED	Production	33	\N	{"bf": 20, "id": 33, "gsm": "120.00", "deckle": "1820.50", "status": "In Production", "barcode": "MK-MK-20260705-PM1-0003-1783256616087", "remarks": "Integration test reel", "end_time": null, "grade_id": 1, "length_m": "5000.00", "shift_id": null, "width_mm": "1800.00", "speed_mpm": null, "weight_kg": "950.500", "created_at": "2026-07-05T13:03:36.082Z", "machine_id": 1, "reject_pct": null, "start_time": null, "updated_at": "2026-07-05T13:03:36.082Z", "operator_id": 1, "reel_number": "MK-20260705-PM1-0003", "downtime_min": null, "moisture_pct": "6.80", "rack_location": null, "reject_reason": null, "break_time_min": null, "efficiency_pct": "100.00", "quality_status": "Pending", "sales_order_id": null, "steam_pressure": null, "steam_consumption": null, "water_consumption": null, "production_time_min": 45}	::1	2026-07-05 18:33:36.082502
12	1	DOWNTIME_LOGGED	Production	9	\N	{"id": 9, "reason": "Vacuum box bolt broken/cracked - test remarks", "reel_id": null, "category": "Mechanical", "end_time": "2026-07-05T07:48:36.106Z", "shift_id": null, "created_at": "2026-07-05T13:03:36.109Z", "machine_id": 1, "start_time": "2026-07-05T07:33:36.105Z", "reported_by": 1, "duration_min": 15, "reason_code_id": 1, "corrective_action": "Replaced bolt"}	::1	2026-07-05 18:33:36.109082
13	1	SHIFT_OPENED	Production	1	\N	{"id": 1, "date": "2026-07-04T18:30:00.000Z", "status": "Open", "remarks": null, "end_time": "2026-07-05T18:45:00.000Z", "created_at": "2026-07-05T18:44:00.410Z", "machine_id": 1, "shift_type": "Day", "start_time": "2026-07-05T18:43:00.000Z", "supervisor_id": 1}	::1	2026-07-06 00:14:00.410294
14	1	REEL_CREATED	Production	34	\N	{"bf": 23, "id": 34, "gsm": "2.00", "deckle": null, "status": "In Production", "barcode": "MK-MK-20260705-PM1-0004-1783277096294", "remarks": null, "end_time": null, "grade_id": 1, "length_m": "232.00", "shift_id": 1, "width_mm": "23.00", "speed_mpm": null, "weight_kg": "222.000", "created_at": "2026-07-05T18:44:56.293Z", "machine_id": 1, "reject_pct": "23.00", "start_time": null, "updated_at": "2026-07-05T18:44:56.293Z", "operator_id": 12, "reel_number": "MK-20260705-PM1-0004", "downtime_min": null, "moisture_pct": "12.00", "rack_location": null, "reject_reason": null, "break_time_min": null, "efficiency_pct": "100.00", "quality_status": "Pending", "sales_order_id": null, "steam_pressure": null, "steam_consumption": null, "water_consumption": null, "production_time_min": 23}	::1	2026-07-06 00:14:56.293375
15	3	UPSERT	production	13	\N	{"report_date": "2026-07-05T18:30:00.000Z"}	::1	2026-07-06 00:55:27.478393
16	3	UPSERT	production	14	\N	{"report_date": "2026-07-05T18:30:00.000Z"}	::1	2026-07-06 00:55:52.228696
17	1	SHIFT_OPENED	Production	2	\N	{"id": 2, "date": "2026-07-07T18:30:00.000Z", "status": "Open", "remarks": "jhgg", "end_time": "2026-07-09T07:19:00.000Z", "created_at": "2026-07-08T07:19:20.882Z", "machine_id": 1, "shift_type": "Day", "start_time": "2026-07-08T07:19:00.000Z", "supervisor_id": 1}	::1	2026-07-08 12:49:20.882306
18	1	POST /machines	master	\N	\N	{"code": "TESTM1", "name": "Test Machine XYZ", "type": "PM"}	::1	2026-07-10 19:49:50.537059
19	1	PAYMENT_RECORDED	Finance	2	\N	{"id": 2, "amount": "5000.00", "status": "Pending", "remarks": null, "created_at": "2026-07-10T14:29:54.597Z", "recorded_by": 1, "confirmed_at": null, "confirmed_by": null, "payment_date": "2026-07-09T18:30:00.000Z", "payment_mode": "Bank", "payment_number": "PY-20260710-0001", "sales_order_id": 1, "reference_number": null}	::1	2026-07-10 19:59:54.597617
20	1	PAYMENT_CONFIRMED	Finance	2	\N	{"id": 2, "amount": "5000.00", "status": "Confirmed", "remarks": null, "created_at": "2026-07-10T14:29:54.597Z", "recorded_by": 1, "confirmed_at": "2026-07-10T14:29:54.864Z", "confirmed_by": 1, "payment_date": "2026-07-09T18:30:00.000Z", "payment_mode": "Bank", "payment_number": "PY-20260710-0001", "sales_order_id": 1, "reference_number": null}	::1	2026-07-10 19:59:54.867866
21	6	PAYMENT_RECORDED	Finance	3	\N	{"id": 3, "amount": "1000.00", "status": "Pending", "remarks": null, "created_at": "2026-07-10T14:30:06.376Z", "recorded_by": 6, "confirmed_at": null, "confirmed_by": null, "payment_date": "2026-07-09T18:30:00.000Z", "payment_mode": "Cash", "payment_number": "PY-20260710-0002", "sales_order_id": 1, "reference_number": null}	::1	2026-07-10 20:00:06.376596
22	6	DELETE /vendors/1	master	1	\N	{}	::1	2026-07-10 20:16:17.735132
23	1	PUT /vendors/1/restore	master	1	\N	{}	::1	2026-07-10 20:16:17.887395
24	1	POST /motors	master	\N	\N	{"hp": 6.7, "kw": 5, "rpm": 1440, "full_amp": 10, "motor_name": "TEST MOTOR ADD", "bearing_no_bs": "6205-2Z", "bearing_no_fs": "6205-2Z", "section_label": "Boiler"}	::1	2026-07-10 21:17:14.871513
25	1	DELETE /motors/166	master	166	\N	{}	::1	2026-07-10 21:17:30.347628
26	1	POST /motors	master	\N	\N	{"motor_name": "EDITTEST", "section_label": "Boiler"}	::1	2026-07-10 21:25:51.42512
27	1	PUT /motors/167	master	167	\N	{"kw": 9, "motor_name": "EDITTEST2", "section_label": "Boiler"}	::1	2026-07-10 21:25:51.773033
28	1	DELETE /motors/167	master	167	\N	{}	::1	2026-07-10 21:25:51.86569
29	1	POST /vendors	master	\N	\N	{"gst": "GST123", "name": "Global Scrap Co", "email": "global@scrap.com", "phone": "1234567890", "address": "123 Scrap Yard"}	::1	2026-07-10 23:54:50.228507
30	1	POST /customers	master	\N	\N	{"gst": "GST987", "name": "Premium Packagers", "email": "prem@pack.com", "phone": "0987654321", "address": "456 Paper St", "credit_days": 30, "credit_limit": 1000000}	::1	2026-07-10 23:54:50.374187
31	1	SHIFT_OPENED	Production	3	\N	{"id": 3, "date": "2026-07-10T18:30:00.000Z", "status": "Open", "remarks": "shift starting. ", "end_time": "2026-07-12T09:06:00.000Z", "created_at": "2026-07-11T09:09:27.329Z", "machine_id": 1, "shift_type": "Day", "start_time": "2026-07-11T09:06:00.000Z", "supervisor_id": 1}	::1	2026-07-11 14:39:27.329021
\.


--
-- Data for Name: boiler_performance_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.boiler_performance_logs (id, log_time, steam_flow_kgh, steam_pressure_bar, feedwater_temp_c, flue_gas_temp_c, husk_consumed_kg, blowdown_rate_pct, efficiency_pct, logged_by, created_at) FROM stdin;
2	2026-07-06 17:30:00+05:30	15000.00	10.00	60.00	\N	3000.00	0.00	93.75	\N	2026-07-06 01:25:54.147751+05:30
\.


--
-- Data for Name: chemical_consumption; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chemical_consumption (id, date, shift_type, chemical_id, qty_consumed, unit_cost, total_cost, recorded_by, created_at) FROM stdin;
\.


--
-- Data for Name: chemical_limit_alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chemical_limit_alerts (id, alert_date, chemical_id, actual_ratio, standard_ratio, status, created_at) FROM stdin;
\.


--
-- Data for Name: clearance_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clearance_items (id, separation_id, department_id, dept_name, item_description, status, cleared_by, cleared_on, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, code, name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, credit_limit, credit_days, is_active, created_at, deleted_by) FROM stdin;
1	TESTCUST1	Test Customer Co	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0	t	2026-07-10 19:59:04.165562	\N
2	CST-0002	Premium Packagers	\N	\N	456 Paper St	\N	\N	\N	\N	\N	prem@pack.com	1000000.00	30	t	2026-07-10 23:54:50.370472	\N
\.


--
-- Data for Name: daily_production_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_production_reports (id, report_date, machine_id, pmc_production_mt, finish_production_mt, total_sets, running_minutes, down_minutes, furnish_local_mt, furnish_occ_mt, furnish_total_mt, power_units, dg_units, rice_husk_mt, total_steam_mt, status, remarks, created_by, approved_by, created_at, updated_at, start_time, end_time, gsm_raw, bf_raw, draw_avg, machine_speed_avg, moisture_pct_avg, prv_pressure_temp, pulper_running_minutes, pulper_units, etp_inlet_ppm, etp_outlet_ppm, etp_inlet_flow, etp_outlet_flow, fresh_water_mt, feed_water_mt, condensate_water_mt) FROM stdin;
7	2026-06-20	1	182.020	182.020	0	1104	53	8.500	26.350	34.850	43302.00	0.00	46.260	255.760	Draft	\N	3	\N	2026-07-06 00:39:46.563344+05:30	2026-07-06 00:39:46.563344+05:30	\N	\N	120/140/150/180	18	2.50	256.57	7.49	12bar/200C	936	120.00	45.00	12.00	1200.00	1150.00	250.000	51.050	40.000
1	2026-06-29	1	165.000	164.841	98	1290	150	166.850	16.150	183.000	39150.00	0.00	47.891	274.000	Approved	\N	1	1	2026-07-01 00:19:35.303277+05:30	2026-07-06 00:42:39.571396+05:30	\N	\N	\N	\N	0.00	0.00	0.00	\N	0	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.000
14	2026-07-06	1	100.000	95.000	0	1200	240	0.000	0.000	0.000	0.00	0.00	0.000	0.000	Draft	\N	3	\N	2026-07-06 00:55:52.228696+05:30	2026-07-06 00:55:52.228696+05:30	\N	\N	120	18	0.00	270.00	0.00	\N	0	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.000
9	2026-06-21	1	182.020	182.020	0	0	53	0.000	0.000	0.000	43302.00	0.00	46.260	255.760	Draft	\N	3	\N	2026-07-06 00:40:03.231264+05:30	2026-07-06 01:09:07.659102+05:30	\N	\N	120/140/150/180	\N	0.00	256.57	0.00	\N	1104	0.00	NaN	NaN	0.00	0.00	0.000	51.050	0.000
16	2026-06-22	1	180.330	180.330	0	0	113	0.000	0.000	0.000	37035.00	0.00	41.270	233.460	Draft	\N	3	\N	2026-07-06 00:58:56.870994+05:30	2026-07-06 01:09:07.659102+05:30	\N	\N	180/200/250	\N	0.00	208.14	0.00	\N	1050	0.00	NaN	NaN	0.00	0.00	0.000	77.250	0.000
8	2026-06-23	1	153.700	153.700	0	1328	112	0.000	0.000	0.000	38635.00	0.00	40.891	227.990	Draft	\N	3	\N	2026-07-06 00:39:46.563344+05:30	2026-07-06 01:09:07.659102+05:30	\N	\N	180/150/120	\N	0.00	259.06	0.00	\N	22464	0.00	NaN	NaN	0.00	0.00	0.000	134.750	99.000
10	2026-06-24	1	135.600	135.600	0	1274	166	0.000	0.000	0.000	37805.00	0.00	37.768	209.140	Draft	\N	3	\N	2026-07-06 00:40:03.231264+05:30	2026-07-06 01:09:07.659102+05:30	\N	\N	120	20/18	0.00	267.88	0.00	\N	804	0.00	NaN	NaN	1408.00	0.00	0.000	127.250	80.000
19	2026-06-25	1	140.070	140.070	0	1316	124	0.000	0.000	0.000	38074.00	0.00	40.677	239.980	Draft	\N	3	\N	2026-07-06 00:58:56.870994+05:30	2026-07-06 01:09:07.659102+05:30	\N	\N	120/140	18	0.00	267.55	0.00	\N	876	0.00	NaN	NaN	1243.00	0.00	0.000	99.200	63.000
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, code, created_at, category) FROM stdin;
1	Production	PROD	2026-06-26 18:13:01.372505	Production & Operations
8	Maintenance	MAINT	2026-06-26 18:13:01.372505	Production & Operations
9	Utility	UTIL	2026-06-26 18:13:01.372505	Production & Operations
2	Raw Material Store	RMS	2026-06-26 18:13:01.372505	Materials & Stores
3	Inventory	INV	2026-06-26 18:13:01.372505	Materials & Stores
4	Store Management	STORE	2026-06-26 18:13:01.372505	Materials & Stores
5	Indent Management	INDENT	2026-06-26 18:13:01.372505	Materials & Stores
19	Packing	PACK	2026-06-26 18:13:01.372505	Materials & Stores
20	Finished Goods Warehouse	FGW	2026-06-26 18:13:01.372505	Materials & Stores
7	Quality	QC	2026-06-26 18:13:01.372505	Quality & Lab
14	Laboratory	LAB	2026-06-26 18:13:01.372505	Quality & Lab
6	Purchase	PUR	2026-06-26 18:13:01.372505	Supply Chain
10	Dispatch	DISP	2026-06-26 18:13:01.372505	Supply Chain
11	Sales	SALES	2026-06-26 18:13:01.372505	Supply Chain
12	HR & Payroll	HR	2026-06-26 18:13:01.372505	Commercial & Admin
15	Finance	FIN	2026-06-26 18:13:01.372505	Commercial & Admin
16	Administration	ADMIN	2026-06-26 18:13:01.372505	Commercial & Admin
13	Security	SEC	2026-06-26 18:13:01.372505	Safety & Compliance
17	EHS	EHS	2026-06-26 18:13:01.372505	Safety & Compliance
18	Scrap Management	SCRAP	2026-06-26 18:13:01.372505	Safety & Compliance
\.


--
-- Data for Name: dispatch_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dispatch_items (id, dispatch_id, reel_id, weight_kg) FROM stdin;
\.


--
-- Data for Name: dispatch_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dispatch_orders (id, do_number, date, so_id, customer_id, vehicle_number, driver_name, driver_mobile, transporter, lr_number, eway_bill, invoice_number, total_weight_kg, total_reels, status, dispatched_by, created_at) FROM stdin;
\.


--
-- Data for Name: downtime_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.downtime_entries (id, shift_id, machine_id, reel_id, start_time, end_time, duration_min, category, reason, corrective_action, reported_by, created_at, reason_code_id) FROM stdin;
7	\N	1	\N	2026-07-05 12:29:23.789	2026-07-05 12:44:23.79	15	Mechanical	Vacuum box bolt broken/cracked - test remarks	Replaced bolt	1	2026-07-05 17:59:23.793027	1
8	\N	1	\N	2026-07-05 12:29:38.462	2026-07-05 12:44:38.463	15	Mechanical	Vacuum box bolt broken/cracked - test remarks	Replaced bolt	1	2026-07-05 17:59:38.4656	1
9	\N	1	\N	2026-07-05 13:03:36.105	2026-07-05 13:18:36.106	15	Mechanical	Vacuum box bolt broken/cracked - test remarks	Replaced bolt	1	2026-07-05 18:33:36.109082	1
10	\N	1	\N	2026-07-10 21:31:03.005	\N	\N	Mechanical	test	\N	1	2026-07-10 21:31:02.99173	\N
\.


--
-- Data for Name: downtime_reason_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.downtime_reason_codes (id, reason_code, category, subcategory, component, description, is_breakdown, severity, typical_minutes, is_active) FROM stdin;
1	MECH-VBOX-001	Mechanical	Breakdown	1st Press Vacuum Box	Vacuum box bolt broken/cracked	t	Medium	60	t
2	MECH-VBOX-002	Mechanical	Breakdown	1st Press Vacuum Box	Vacuum box seal strip worn	t	Medium	45	t
3	MECH-PRESS-001	Mechanical	Breakdown	Press Section	Press roll bearing failure	t	High	120	t
4	MECH-DRYER-001	Mechanical	Breakdown	Dryer Section	Dryer steam joint leak	t	High	90	t
5	PROC-PBRK-001	Process	Paper Break	Press Section	Paper break at press	f	Low	25	t
6	PROC-PBRK-002	Process	Paper Break	Dryer Section	Paper break at dryer	f	Low	30	t
7	PROC-GRDCHG-001	Process	Grade Change	\N	Grade change (GSM/width)	f	Low	45	t
8	UTIL-POWERCUT-001	Utility	Power Failure	\N	External power failure (grid)	t	High	65	t
9	UTIL-STEAM-001	Utility	Steam Failure	\N	Low steam pressure	t	Medium	30	t
10	PLAN-MAINT-001	Planned	Maintenance	\N	Planned maintenance stop	f	Low	\N	t
\.


--
-- Data for Name: dpr_chemical_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dpr_chemical_lines (id, report_id, chemical_name, chemical_id, qty_kg, sort_order) FROM stdin;
\.


--
-- Data for Name: dpr_downtime_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dpr_downtime_lines (id, report_id, shift, minutes, reason, sort_order, reason_code) FROM stdin;
6	1	Day+Night	60	1st press vacuum box bolt broken	0	\N
7	1	Day+Night	65	power cut	1	\N
8	1	Day+Night	25	paper break	2	\N
\.


--
-- Data for Name: dpr_grade_standards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dpr_grade_standards (id, grade_code, starch_kg_per_ton, pac_kg_per_ton, surface_size_kg_per_ton, coagulant_kg_per_ton, deformer_kg_per_ton, retention_kg_per_ton, power_unit_per_ton, steam_mt_per_ton, husk_mt_per_ton, yield_pct, is_active, se_bond_kg_per_ton, sigmaexor_etp_kg_per_ton) FROM stdin;
2	KP	35.000	1.800	0.600	0.500	0.400	0.120	240.000	1.700	0.300	92.00	t	0.200	0.150
3	WP	20.000	1.200	0.400	0.300	0.250	0.080	220.000	1.500	0.250	90.00	t	0.100	0.100
4	NP	15.000	1.000	0.300	0.200	0.200	0.060	200.000	1.400	0.220	89.00	t	0.050	0.080
5	BRD	40.000	2.000	0.800	0.600	0.500	0.150	260.000	1.800	0.320	93.00	t	0.300	0.200
6	TIS	10.000	0.800	0.200	0.150	0.150	0.050	180.000	1.300	0.200	88.00	t	0.020	0.050
1	DEFAULT	28.000	1.500	0.500	0.400	0.300	0.100	230.000	1.600	0.280	91.00	t	0.000	0.000
\.


--
-- Data for Name: dpr_gsm_breakup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dpr_gsm_breakup (id, report_id, gsm, bf, sets, production_mt, sort_order) FROM stdin;
12	1	150.0	22.0	3	5.000	0
13	1	140.0	22.0	23	39.000	1
14	1	180.0	22.0	13	22.000	2
15	1	150.0	20.0	1	1.500	3
16	1	140.0	20.0	10	17.000	4
17	1	180.0	20.0	7	12.000	5
18	1	180.0	18.0	1	1.500	6
19	1	140.0	18.0	40	67.000	7
23	7	120.0	18.0	0	0.000	0
24	7	140.0	18.0	0	0.000	1
25	7	150.0	18.0	0	0.000	2
26	7	180.0	18.0	0	0.000	3
77	9	120.0	\N	0	0.000	0
78	9	140.0	\N	0	0.000	1
79	9	150.0	\N	0	0.000	2
80	9	180.0	\N	0	0.000	3
81	16	180.0	\N	0	0.000	0
82	16	200.0	\N	0	0.000	1
83	16	250.0	\N	0	0.000	2
84	8	180.0	\N	0	0.000	0
85	8	150.0	\N	0	0.000	1
86	8	120.0	\N	0	0.000	2
87	10	120.0	20.0	0	0.000	0
88	19	120.0	18.0	0	0.000	0
89	19	140.0	18.0	0	0.000	1
\.


--
-- Data for Name: ehs_incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ehs_incidents (id, incident_number, date, incident_time, incident_type, severity, location, department_id, description, injured_person, root_cause, corrective_action, reported_by, status, closure_date, created_at) FROM stdin;
1	EHS-20260710-0001	2026-07-10	\N	Near Miss	Low	Test	\N	test	\N	\N	\N	1	Open	\N	2026-07-10 19:49:50.686776
\.


--
-- Data for Name: employee_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_documents (id, employee_id, doc_type, doc_name, file_url, file_size_kb, uploaded_by, valid_from, valid_to, is_confidential, notes, created_at) FROM stdin;
\.


--
-- Data for Name: employee_leave_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_leave_balances (id, employee_id, leave_type_id, year, opening_balance, credited, availed, encashed, lapsed, updated_at) FROM stdin;
1	4	1	2026	0.00	7.00	0.00	0.00	0.00	2026-06-30 23:52:53.118744+05:30
2	4	2	2026	0.00	7.00	0.00	0.00	0.00	2026-06-30 23:52:53.118744+05:30
3	4	3	2026	0.00	12.25	0.00	0.00	0.00	2026-06-30 23:52:53.118744+05:30
4	4	5	2026	0.00	106.17	0.00	0.00	0.00	2026-06-30 23:52:53.118744+05:30
5	4	6	2026	0.00	8.75	0.00	0.00	0.00	2026-06-30 23:52:53.118744+05:30
\.


--
-- Data for Name: employee_leave_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_leave_types (id, code, name, annual_quota, carry_forward, max_carry_days, encashable, paid, gender_restrict, min_service_days, description, is_active, created_at) FROM stdin;
1	CL	Casual Leave	12.00	f	0	f	t	\N	0	\N	t	2026-06-30 23:52:52.950125+05:30
2	SL	Sick Leave	12.00	f	0	f	t	\N	0	\N	t	2026-06-30 23:52:52.950125+05:30
3	EL	Earned Leave	21.00	t	45	t	t	\N	240	\N	t	2026-06-30 23:52:52.950125+05:30
4	CO	Comp Off	\N	f	0	f	t	\N	0	\N	t	2026-06-30 23:52:52.950125+05:30
5	ML	Maternity Leave	182.00	f	0	f	t	Female	80	\N	t	2026-06-30 23:52:52.950125+05:30
6	PL	Paternity Leave	15.00	f	0	f	t	Male	0	\N	t	2026-06-30 23:52:52.950125+05:30
7	LOP	Loss of Pay	\N	f	0	f	f	\N	0	\N	t	2026-06-30 23:52:52.950125+05:30
8	HL	Holiday	\N	f	0	f	t	\N	0	\N	t	2026-06-30 23:52:52.950125+05:30
\.


--
-- Data for Name: employee_loans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_loans (id, employee_id, loan_type, amount, disbursed_date, monthly_emi, outstanding, status, notes, approved_by, created_at) FROM stdin;
\.


--
-- Data for Name: employee_salary_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_salary_assignments (id, employee_id, salary_structure_id, effective_from, effective_to, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, user_id, employee_code, name, department_id, designation, doj, dob, gender, mobile, email, aadhar, pan, pf_number, esic_number, bank_account, bank_name, ifsc, basic_salary, is_active, created_at, middle_name, father_name, blood_group, nationality, marital_status, permanent_address, current_address, emergency_contact, emergency_mobile, photo_url, employment_type, grade, reporting_to, shift_pattern, confirmation_date, probation_end, date_of_leaving, separation_type, uan_number, gratuity_nomination, is_dept_head, cost_center, updated_at) FROM stdin;
4	6	DH-STORE	Abdul mannan	4	manager	2026-06-30	1983-06-06	Male	9985589559	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-06-30 23:17:46.111722	\N	\N	\N	Indian	\N	\N	\N	\N	\N	\N	Permanent	\N	\N	General	\N	\N	\N	\N	\N	\N	t	\N	2026-07-01 00:00:45.001649
\.


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipment (id, name, code, type, section_id, hp, amps, is_active, created_at, bearing_no_fs, bearing_no_bs) FROM stdin;
1	Bottom Headbox	PM1-WIRE-01	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
2	Holly roll-1	PM1-WIRE-02	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
3	Holly roll-2	PM1-WIRE-03	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
4	Bottom Wire  Couch Roll	PM1-WIRE-04	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
5	Bottom Wire Breast Roll	PM1-WIRE-05	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
6	Bottom Wire Forward (FDR)Drive Roll	PM1-WIRE-06	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
7	Bottom Wire Tension Roll-1	PM1-WIRE-07	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
8	Bottom Wire Tension Roll-2	PM1-WIRE-08	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
9	Bottom Wire Tension Roll-3	PM1-WIRE-09	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
10	Bottom Wire Wash Roll	PM1-WIRE-10	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
11	Bottom Wire Guide Roll	PM1-WIRE-11	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
12	Bottom Wire Return Roll	PM1-WIRE-12	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
13	Bottom Wire Wire  Roll-1	PM1-WIRE-13	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
14	Bottom Wire Wire  Roll-2	PM1-WIRE-14	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
15	Top Wire Breast Roll	PM1-WIRE-15	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
16	Top Wire Drive (Turning)Roll	PM1-WIRE-16	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
17	Top Wire Combination Roll	PM1-WIRE-17	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
18	Top Wire Tension Roll-1	PM1-WIRE-18	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
19	Top Wire Tension Roll-2	PM1-WIRE-19	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
20	Top Wire Guide Roll	PM1-WIRE-20	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
21	Top Headbox	PM1-WIRE-21	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
22	Holly roll-1	PM1-WIRE-22	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
23	Holly roll-2	PM1-WIRE-23	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
24	Couch Pit Pump(CPC100/320)	PM1-WIRE-24	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
25	Couch Pit Agitator	PM1-WIRE-25	Roll	11	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
26	1st Press Top Roll	PM1-PRESS-1ST-1	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
27	1st Press Bottom Roll	PM1-PRESS-1ST-2	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
28	1st Press Top Felt Rolls	PM1-PRESS-1ST-3	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
29	1st Press Bottom Felt Rolls	PM1-PRESS-1ST-4	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
30	1st Press Top Drive Rolls	PM1-PRESS-1ST-5	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
31	1st Press Bottom Drive Rolls	PM1-PRESS-1ST-6	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
32	1st Press Top gearbox	PM1-PRESS-1ST-7	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
33	1st Press Bottom gearbox	PM1-PRESS-1ST-8	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
34	1st Press Top cordan saft	PM1-PRESS-1ST-9	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
35	1st Press Bottom cordan saft	PM1-PRESS-1ST-10	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
36	1st press Top Aotoguide	PM1-PRESS-1ST-11	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
37	1st press Bottom Aotoguide	PM1-PRESS-1ST-12	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
38	1st press Top Stracher roll	PM1-PRESS-1ST-13	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
39	1st press Bottom Stracher roll	PM1-PRESS-1ST-14	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
40	2nd Press Top Roll	PM1-PRESS-2ND-1	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
41	2nd Press Bottom Roll	PM1-PRESS-2ND-2	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
42	2nd Press Top Drive Rolls	PM1-PRESS-2ND-3	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
43	2nd Press Bottom Drive Rolls	PM1-PRESS-2ND-4	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
44	2nd Press Top gearbox	PM1-PRESS-2ND-5	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
45	2nd Press Bottom gearbox	PM1-PRESS-2ND-6	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
46	2nd Press Top cordan saft	PM1-PRESS-2ND-7	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
47	2nd Press Bottom cordan saft	PM1-PRESS-2ND-8	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
48	2nd press Top Aotoguide	PM1-PRESS-2ND-9	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
49	2nd press Bottom Aotoguide	PM1-PRESS-2ND-10	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
50	2nd press Top Stracher roll	PM1-PRESS-2ND-11	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
51	2nd press Bottom Stracher roll	PM1-PRESS-2ND-12	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
52	2nd Press Top Felt Rolls	PM1-PRESS-2ND-13	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
53	2nd Press Bottom Felt Rolls	PM1-PRESS-2ND-14	Roll	13	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
54	Unirun Drive roll-1	PM1-UNIRUN-01	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
55	Unirun Drive roll-2	PM1-UNIRUN-02	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
56	Unirun gear box-1	PM1-UNIRUN-03	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
57	Unirun gear box-2	PM1-UNIRUN-04	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
58	Unirun cordan saft-1	PM1-UNIRUN-05	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
59	Unirun cordan saft-2	PM1-UNIRUN-06	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
60	Unirun Dryer-1	PM1-UNIRUN-07	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
61	Unirun Dryer-2	PM1-UNIRUN-08	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
62	Unirun Dryer-3	PM1-UNIRUN-09	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
63	Unirun Dryer-4	PM1-UNIRUN-10	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
64	Unirun Dryer-5	PM1-UNIRUN-11	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
65	Unirun Dryer-6	PM1-UNIRUN-12	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
66	Unirun autoguide	PM1-UNIRUN-13	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
67	Unirun stracher roll	PM1-UNIRUN-14	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
68	Unirun Paper roll	PM1-UNIRUN-15	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
69	Unirun Screen roll-1	PM1-UNIRUN-16	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
70	Unirun Screen roll-2	PM1-UNIRUN-17	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
71	Unirun Screen roll-3	PM1-UNIRUN-18	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
72	Unirun Screen roll-4	PM1-UNIRUN-19	Roll	14	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
73	Pre dryer Top Drive roll-1	PM1-PRE_DRYER-01	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
74	Pre dryer Top Drive roll-2	PM1-PRE_DRYER-02	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
75	Pre dryer Bottom Drive roll-1	PM1-PRE_DRYER-03	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
76	Pre dryer Bottom Drive roll-2	PM1-PRE_DRYER-04	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
77	Pre dryer-1	PM1-PRE_DRYER-05	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
78	Pre dryer-2	PM1-PRE_DRYER-06	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
79	Pre dryer-3	PM1-PRE_DRYER-07	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
80	Pre dryer-4	PM1-PRE_DRYER-08	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
81	Pre dryer-5	PM1-PRE_DRYER-09	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
82	Pre dryer-6	PM1-PRE_DRYER-10	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
83	Pre dryer-7	PM1-PRE_DRYER-11	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
84	Pre dryer-8	PM1-PRE_DRYER-12	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
85	Pre dryer Top Stracher roll	PM1-PRE_DRYER-13	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
86	Pre dryer Bottom Stracher roll	PM1-PRE_DRYER-14	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
87	Pre dryer Top guide roll	PM1-PRE_DRYER-15	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
88	Pre dryer Bottom guide roll	PM1-PRE_DRYER-16	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
89	Pre dryer Top Screen roll-1	PM1-PRE_DRYER-17	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
90	Pre dryer Top Screen roll-2	PM1-PRE_DRYER-18	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
91	Pre dryer Top Screen roll-3	PM1-PRE_DRYER-19	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
92	Pre dryer Top Screen roll-4	PM1-PRE_DRYER-20	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
93	Pre dryer Top Screen roll-5	PM1-PRE_DRYER-21	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
94	Pre dryer Top Screen roll-6	PM1-PRE_DRYER-22	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
95	Pre dryer Bottom Screen roll-1	PM1-PRE_DRYER-23	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
96	Pre dryer Bottom Screen roll-2	PM1-PRE_DRYER-24	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
97	Pre dryer Bottom Screen roll-3	PM1-PRE_DRYER-25	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
98	Pre dryer Bottom Screen roll-4	PM1-PRE_DRYER-26	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
99	Pre dryer Bottom Screen roll-5	PM1-PRE_DRYER-27	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
100	Pre dryer Top Cardan saft-1	PM1-PRE_DRYER-28	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
101	Pre dryer Top Cardan saft-2	PM1-PRE_DRYER-29	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
102	Pre dryer Bottom Cardan saft-1	PM1-PRE_DRYER-30	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
103	Pre dryer Bottom Cardan saft-2	PM1-PRE_DRYER-31	Roll	15	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
104	Post dryer Top-1	PM1-POST_DRYER-01	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
105	Post dryer Top-2	PM1-POST_DRYER-02	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
106	Post dryer Top-3	PM1-POST_DRYER-03	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
107	Post dryer Top-4	PM1-POST_DRYER-04	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
108	Post dryer Bottom-1	PM1-POST_DRYER-05	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
109	Post dryer Bottom-2	PM1-POST_DRYER-06	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
110	Post dryer Bottom-3	PM1-POST_DRYER-07	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
111	Post dryer Bottom-4	PM1-POST_DRYER-08	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
112	Post dryer Bottom Drive roll-1	PM1-POST_DRYER-09	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
113	Post dryer Bottom Drive roll-2	PM1-POST_DRYER-10	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
114	Post dryer Top Drive roll-1	PM1-POST_DRYER-11	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
115	Post dryer Top Drive roll-2	PM1-POST_DRYER-12	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
116	Post dryer Top Screen roll-1	PM1-POST_DRYER-13	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
117	Post dryer Top Screen roll-2	PM1-POST_DRYER-14	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
118	Post dryer Top Screen roll-3	PM1-POST_DRYER-15	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
119	Post dryer Top Screen roll-4	PM1-POST_DRYER-16	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
120	Post dryer Top Screen roll-5	PM1-POST_DRYER-17	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
121	Post dryer Top Screen roll-6	PM1-POST_DRYER-18	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
122	Post dryer Bottom Screen roll-1	PM1-POST_DRYER-19	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
123	Post dryer Bottom Screen roll-2	PM1-POST_DRYER-20	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
124	Post dryer Bottom Screen roll-3	PM1-POST_DRYER-21	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
125	Post dryer Bottom Screen roll-4	PM1-POST_DRYER-22	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
126	Post dryer Bottom Screen roll-5	PM1-POST_DRYER-23	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
127	Post dryer Bottom Screen roll-6	PM1-POST_DRYER-24	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
128	Post dryer Bottom Guide roll	PM1-POST_DRYER-25	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
129	Post dryer Top Guide roll	PM1-POST_DRYER-26	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
130	Post dryer Top Stracher roll	PM1-POST_DRYER-27	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
131	Post dryer Bottom Stracher roll	PM1-POST_DRYER-28	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
132	Post dryer Bottom Cardan Saft-1	PM1-POST_DRYER-29	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
133	Post dryer Bottom Cardan Saft-2	PM1-POST_DRYER-30	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
134	Post dryerTop Cardan Saft-1	PM1-POST_DRYER-31	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
135	Post dryerTop Cardan Saft-2	PM1-POST_DRYER-32	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
136	Post dryer Top Ger box-1	PM1-POST_DRYER-33	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
137	Post dryer Top Ger box-2	PM1-POST_DRYER-34	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
138	Post dryer Bottom Ger box-1	PM1-POST_DRYER-35	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
139	Post dryer Bottom Ger box-2	PM1-POST_DRYER-36	Roll	18	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
140	Scaner	PM1-POPE_REEL-01	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
141	Pop Reel Camber Roll	PM1-POPE_REEL-02	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
142	Pop Reel Drum	PM1-POPE_REEL-03	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
143	Pop Reel Drive	PM1-POPE_REEL-04	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
144	Pop Reel Ger Box	PM1-POPE_REEL-05	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
145	Pop Reel Cardan Saft	PM1-POPE_REEL-06	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
146	Tumbo roll-1	PM1-POPE_REEL-07	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
147	Tumbo roll-2	PM1-POPE_REEL-08	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
148	Tumbo roll-3	PM1-POPE_REEL-09	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
149	Tumbo roll-4	PM1-POPE_REEL-10	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
150	Tumbo roll-5	PM1-POPE_REEL-11	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
151	Tumbo roll-6	PM1-POPE_REEL-12	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
152	Tumbo roll-7	PM1-POPE_REEL-13	Roll	20	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
153	Rewinder break drum	PM1-REWINDER-01	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
154	Rewinder Cardan saft-1	PM1-REWINDER-02	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
155	Rewinder Cardan saft-2	PM1-REWINDER-03	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
156	Rewinder Camber roll-1	PM1-REWINDER-04	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
157	Rewinder Camber roll-2	PM1-REWINDER-05	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
158	Rewinder Drive roll-1	PM1-REWINDER-06	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
159	Rewinder Drive roll-2	PM1-REWINDER-07	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
160	Rewinder Knife roll	PM1-REWINDER-08	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
161	Rewinder Paper roll	PM1-REWINDER-09	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
162	Rewinder Rider roll	PM1-REWINDER-10	Roll	21	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
163	Vaccum pump-1(Wire)	PM1-VACUUM-01	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
164	Vaccum pump-2(Spare)	PM1-VACUUM-02	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
165	Vaccum pump-3 (Press)	PM1-VACUUM-03	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
166	Saparater Pump Wire-1	PM1-VACUUM-04	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
167	Saparater Pump Wire-2	PM1-VACUUM-05	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
168	Saparater Pump Press-1	PM1-VACUUM-06	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
169	Sling water pump(Vasu)	PM1-VACUUM-07	Roll	12	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
170	Steam Condance Feed Pump-1	PM1-STEAM_COND-01	Roll	23	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
171	Steam Condance Mono block Pump-2	PM1-STEAM_COND-02	Roll	23	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
172	Steam Condance Mono block Pump-3	PM1-STEAM_COND-03	Roll	23	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
173	Size kitchen Cooker Pump	PM1-SIZE_KITCHEN-01	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
174	Size kitchen Service Pump	PM1-SIZE_KITCHEN-02	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
175	Size kitchen Service Tank	PM1-SIZE_KITCHEN-03	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
176	Size kitchen return Pump	PM1-SIZE_KITCHEN-04	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
177	Size kitchen Monoblock Pump	PM1-SIZE_KITCHEN-05	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
178	Size kitchen Vibro	PM1-SIZE_KITCHEN-06	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
179	Size kitchen New Cooker Tank	PM1-SIZE_KITCHEN-07	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
180	Size kitchen New Tank Pump	PM1-SIZE_KITCHEN-08	Roll	17	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
181	Size PressTop Press roll	PM1-SIZE_PRESS-01	Roll	16	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
182	Size Press Bottom Press roll	PM1-SIZE_PRESS-02	Roll	16	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
183	Paper roll	PM1-SIZE_PRESS-03	Roll	16	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
184	Size Press Top Cardan saft	PM1-SIZE_PRESS-04	Roll	16	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
185	Size Press Bottom Cardan saft	PM1-SIZE_PRESS-05	Roll	16	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
186	Calender Roll Top	PM1-CALENDER-01	Roll	19	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
187	Calender Roll Bottom	PM1-CALENDER-02	Roll	19	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
188	Calender Drive Bottom	PM1-CALENDER-03	Roll	19	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
189	Calender Cardan saft Bottom	PM1-CALENDER-04	Roll	19	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
190	Calender Paper Roll	PM1-CALENDER-05	Roll	19	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
191	CC Top Primery Fan pump	PM1-CENTRICLEANER-01	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
192	CC  Top Secondry Fan pump(TPR250/400)	PM1-CENTRICLEANER-02	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
193	CC Top Tersery Fan pump	PM1-CENTRICLEANER-03	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
194	CC Bottom Primery Fan pump(KSB12HS16 SR.No-9973799750/100)	PM1-CENTRICLEANER-04	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
195	CC  Bottom Secondry Fan pump(CPC150/330)	PM1-CENTRICLEANER-05	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
196	CC Bottom Tersery Fan pump(SWP125/320)	PM1-CENTRICLEANER-06	Roll	10	\N	\N	t	2026-07-10 18:59:30.193985	\N	\N
\.


--
-- Data for Name: equipment_inspection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipment_inspection (id, equipment_id, inspector_id, status, check_date, next_check_date, remarks, created_at, fs_status, bs_status, shift, fs_temp, bs_temp, fs_vibration, bs_vibration, fs_number, bs_number) FROM stdin;
1	1	1	Normal	2026-07-10	\N	\N	2026-07-10 19:01:52.24154	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
2	5	1	Normal	2026-07-10	\N	bearing noise	2026-07-10 19:01:52.24154	Critical	Needs Attention	Day	\N	\N	\N	\N	\N	\N
3	9	1	Normal	2026-07-10	\N	vibration high	2026-07-10 19:13:57.317117	Critical	Normal	Night	\N	\N	\N	\N	\N	\N
4	9	1	Normal	2026-07-10	\N	vibration high	2026-07-10 19:19:37.123657	Critical	Normal	Night	\N	\N	\N	\N	\N	\N
5	1	1	Normal	2026-07-10	\N	test remark from import	2026-07-10 21:04:33.099437	Critical	Needs Attention	Day	\N	\N	\N	\N	\N	\N
6	22	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
7	23	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
8	4	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
9	5	1	Normal	2026-07-10	\N	bearing noise	2026-07-10 21:04:33.099437	Critical	Needs Attention	Day	\N	\N	\N	\N	\N	\N
10	6	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
11	7	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
12	8	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
13	9	1	Normal	2026-07-10	\N	vibration high	2026-07-10 21:04:33.099437	Critical	Normal	Day	\N	\N	\N	\N	\N	\N
14	10	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
15	11	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
16	12	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
17	13	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
18	14	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
19	15	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
20	16	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
21	17	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
22	18	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
23	19	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
24	20	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
25	21	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
26	22	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
27	23	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
28	24	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
29	25	1	Normal	2026-07-10	\N	\N	2026-07-10 21:04:33.099437	Normal	Normal	Day	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: etp_readings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.etp_readings (id, date, reading_time, ph, cod, bod, tss, tds, flow_rate, logged_by, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: furnish_mix_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.furnish_mix_log (id, batch_number, report_date, machine_id, shift_type, local_furnish_kg, occ_furnish_kg, other_furnish_kg, local_lot, occ_lot, local_moisture, occ_moisture, prepared_by, remarks, created_at) FROM stdin;
1	FURN-20260629-2760	2026-06-29	1	Day	166850.00	16150.00	0.00	\N	\N	12.00	8.00	1	\N	2026-07-01 00:27:42.761105+05:30
4	FURN-20260705-3799	2026-07-05	1	Day	800.00	1200.00	100.00	LOT-L-101	LOT-O-202	10.50	12.00	1	Furnish test batch	2026-07-05 17:59:23.800064+05:30
5	FURN-20260705-8469	2026-07-05	1	Day	800.00	1200.00	100.00	LOT-L-101	LOT-O-202	10.50	12.00	1	Furnish test batch	2026-07-05 17:59:38.470377+05:30
6	FURN-20260705-6116	2026-07-05	1	Day	800.00	1200.00	100.00	LOT-L-101	LOT-O-202	10.50	12.00	1	Furnish test batch	2026-07-05 18:33:36.116847+05:30
\.


--
-- Data for Name: gate_passes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gate_passes (id, gp_number, date, pass_type, vehicle_type, vehicle_number, driver_name, purpose, material_description, from_party, to_party, in_time, out_time, weight_in, weight_out, net_weight, security_guard_id, status, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: grades; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grades (id, name, code, gsm_min, gsm_max, description, is_active, deleted_by) FROM stdin;
1	Kraft Paper	KP	70.00	200.00	\N	t	\N
2	Writing Paper	WP	60.00	90.00	\N	t	\N
3	Newsprint	NP	45.00	52.00	\N	t	\N
4	Board	BRD	200.00	400.00	\N	t	\N
5	Tissue	TIS	15.00	35.00	\N	t	\N
\.


--
-- Data for Name: grn; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grn (id, grn_number, date, vendor_id, po_id, vehicle_number, challan_number, invoice_number, received_by, status, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: grn_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grn_items (id, grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, batch_number, mfg_date, expiry_date, bin_location, remarks) FROM stdin;
\.


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holidays (id, holiday_date, name, holiday_type, year, is_active, created_at) FROM stdin;
1	2025-01-26	Republic Day	National	2025	t	2026-06-30 23:52:52.863874+05:30
2	2025-03-14	Holi	National	2025	t	2026-06-30 23:52:52.863874+05:30
3	2025-04-14	Dr Ambedkar Jayanti	National	2025	t	2026-06-30 23:52:52.863874+05:30
4	2025-04-18	Good Friday	National	2025	t	2026-06-30 23:52:52.863874+05:30
5	2025-05-01	Maharashtra Day	State	2025	t	2026-06-30 23:52:52.863874+05:30
6	2025-08-15	Independence Day	National	2025	t	2026-06-30 23:52:52.863874+05:30
7	2025-10-02	Gandhi Jayanti	National	2025	t	2026-06-30 23:52:52.863874+05:30
9	2025-10-20	Diwali	National	2025	t	2026-06-30 23:52:52.863874+05:30
10	2025-11-05	Guru Nanak Jayanti	National	2025	t	2026-06-30 23:52:52.863874+05:30
11	2025-12-25	Christmas	National	2025	t	2026-06-30 23:52:52.863874+05:30
12	2026-01-26	Republic Day	National	2026	t	2026-06-30 23:52:52.863874+05:30
13	2026-03-03	Holi	National	2026	t	2026-06-30 23:52:52.863874+05:30
14	2026-04-03	Good Friday	National	2026	t	2026-06-30 23:52:52.863874+05:30
15	2026-04-14	Dr Ambedkar Jayanti	National	2026	t	2026-06-30 23:52:52.863874+05:30
16	2026-05-01	Maharashtra Day	State	2026	t	2026-06-30 23:52:52.863874+05:30
17	2026-08-15	Independence Day	National	2026	t	2026-06-30 23:52:52.863874+05:30
18	2026-10-02	Gandhi Jayanti	National	2026	t	2026-06-30 23:52:52.863874+05:30
19	2026-11-10	Diwali	National	2026	t	2026-06-30 23:52:52.863874+05:30
20	2026-12-25	Christmas	National	2026	t	2026-06-30 23:52:52.863874+05:30
\.


--
-- Data for Name: indent_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.indent_audit_log (id, indent_id, action, old_status, new_status, user_id, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: indent_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.indent_comments (id, issue_id, user_id, message, created_at) FROM stdin;
\.


--
-- Data for Name: indent_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.indent_items (id, indent_id, material_id, required_qty, approved_qty, uom, purpose, current_stock, component_position, section_id, machine_id, unit_price, line_value, issued_qty, batch_no, reason_code, ack_by, ack_at, fitment_date, observations, kpi_before, kpi_after, photo_url, ack_status) FROM stdin;
\.


--
-- Data for Name: indents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.indents (id, indent_number, date, department_id, required_date, priority, status, raised_by, l1_approved_by, l1_approved_at, l2_approved_by, l2_approved_at, l3_approved_by, l3_approved_at, remarks, created_at, section_id, machine_id, total_value, issued_by, issued_at, closed_at, escalated) FROM stdin;
2	IND-20260629-0001	2026-06-29	8	2026-06-29	Urgent	Draft	10	\N	\N	\N	\N	\N	\N	\N	2026-06-29 22:20:52.514065	\N	\N	0.00	\N	\N	\N	f
3	IND-20260705-0001	2026-07-06	16	2026-07-06	Urgent	Draft	3	\N	\N	\N	\N	\N	\N	\N	2026-07-06 01:43:06.776761	\N	\N	0.00	\N	\N	\N	f
4	IND-20260705-0002	2026-07-06	10	2026-07-06	Normal	Draft	3	\N	\N	\N	\N	\N	\N	\N	2026-07-06 01:45:36.123924	\N	\N	0.00	\N	\N	\N	f
5	IND-20260705-0003	2026-07-06	1	2026-07-15	Normal	Draft	3	\N	\N	\N	\N	\N	\N	Native http test raise indent	2026-07-06 01:47:26.34754	\N	\N	0.00	\N	\N	\N	f
6	IND-20260705-0004	2026-07-06	1	60715-02-02	Normal	Draft	3	\N	\N	\N	\N	\N	\N	Selenium E2E test indent - spare parts	2026-07-06 02:04:33.368525	\N	\N	0.00	\N	\N	\N	f
7	IND-20260710-0001	2026-07-10	1	\N	Normal	Draft	1	\N	\N	\N	\N	\N	\N	\N	2026-07-10 19:49:50.327694	\N	\N	0.00	\N	\N	\N	f
\.


--
-- Data for Name: inspection_round_scans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_round_scans (id, section_id, shift, check_date, file_url, original_name, uploaded_by, uploaded_at) FROM stdin;
1	11	Day	2026-07-10	/uploads/maintenance/1783697690208_test_scan.jpg	test_scan.jpg	1	2026-07-10 21:04:50.214513
\.


--
-- Data for Name: installed_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.installed_assets (id, asset_number, material_id, serial_number, batch_number, machine_id, position_id, indent_id, grn_item_id, requested_by, approved_by, issued_by, purchase_price, installed_at, status, retired_at, failure_reason, expected_lifespan_days) FROM stdin;
\.


--
-- Data for Name: lab_samples; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lab_samples (id, sample_number, date, sample_type, source_ref, collected_by, tested_by, brightness, opacity, ph_value, ash_content, moisture, cod, bod, tss, ph_water, concentration, purity, result, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: leave_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_applications (id, employee_id, leave_type_id, from_date, to_date, days, half_day, reason, status, applied_on, approved_by, approved_on, rejection_reason, document_url, balance_before, balance_after, created_at) FROM stdin;
1	4	1	2026-07-02	2026-07-02	1.00	f	\N	Pending	2026-07-01 00:35:22.065089+05:30	\N	\N	\N	\N	7.00	\N	2026-07-01 00:35:22.065089+05:30
\.


--
-- Data for Name: machine_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_events (id, section_id, equipment_id, event_type, severity, event_time, duration_min, resumed_at, root_cause_code, location_detail, description, downtime_entry_id, alarm_id, reported_by, resolved_by, resolution_note, kafka_published, created_at) FROM stdin;
1	1	1	paper_break	Critical	2026-07-05 18:46:58.866512	\N	\N	\N	Wire section P2	Test paper break at wire section	\N	\N	3	\N	\N	f	2026-07-05 18:46:58.866512
2	1	\N	roll_change	Warning	2026-07-05 18:52:25.757345	\N	\N	\N	Press section felt #1	Felt roll changed after 28 days	\N	\N	3	\N	\N	f	2026-07-05 18:52:25.757345
3	1	1	paper_break	Critical	2026-07-05 18:52:25.763285	\N	\N	\N	Wire P2 vacuum zone	Paper break at wire section P2	\N	\N	3	\N	\N	t	2026-07-05 18:52:25.763285
\.


--
-- Data for Name: machine_positions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_positions (id, machine_id, name, code, is_active, created_at) FROM stdin;
1	1	Dryer Section 5 / Drive End Bearing	PM-DRY5-DEBRG	t	2026-06-29 11:01:06.709966
2	1	Press Section 2 / Top Roll	PM-PRSS2-TPROLL	t	2026-06-29 11:01:06.709966
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machines (id, name, code, type, capacity_tpd, is_active, created_at, ideal_speed_mpm, design_speed_mpm, deleted_by) FROM stdin;
1	Paper Machine 1	PM1	Paper Machine	50.00	t	2026-06-26 18:13:01.679235	0.00	300.00	\N
2	Paper Machine 2	PM2	Paper Machine	60.00	t	2026-06-26 18:13:01.679235	0.00	300.00	\N
3	Rewinder 1	RW1	Rewinder	100.00	t	2026-06-26 18:13:01.679235	0.00	300.00	\N
4	Cutter 1	CT1	Cutter	80.00	t	2026-06-26 18:13:01.679235	0.00	300.00	\N
5	Test Machine XYZ	TESTM1	PM	\N	t	2026-07-10 19:49:50.531587	0.00	300.00	\N
6	Pulp mill Section	PMS	Pulper	100.00	t	2026-07-10 22:48:15.383581	300.00	300.00	\N
7	Centricleaner Section	CS	Paper Machine	100.00	t	2026-07-10 22:48:15.391307	300.00	300.00	\N
8	Wire Section	WS	Paper Machine	100.00	t	2026-07-10 22:48:15.393186	300.00	300.00	\N
9	Vacuum Section	VS	Paper Machine	100.00	t	2026-07-10 22:48:15.395256	300.00	300.00	\N
10	Press Section	PS	Paper Machine	100.00	t	2026-07-10 22:48:15.396819	300.00	300.00	\N
11	Unirun Section	US	Paper Machine	100.00	t	2026-07-10 22:48:15.398184	300.00	300.00	\N
12	Pre Dryer Section	PDS	Paper Machine	100.00	t	2026-07-10 22:48:15.399608	300.00	300.00	\N
13	Size Press Section	SPS	Paper Machine	100.00	t	2026-07-10 22:48:15.401137	300.00	300.00	\N
14	Size kitchen Section	SKS	Paper Machine	100.00	t	2026-07-10 22:48:15.402658	300.00	300.00	\N
16	Post Dryer Section	PDS10	Paper Machine	100.00	t	2026-07-10 22:48:33.578542	300.00	300.00	\N
17	Calender Section	CS11	Paper Machine	100.00	t	2026-07-10 22:48:33.585038	300.00	300.00	\N
18	Pope Reel Section	PRS12	Paper Machine	100.00	t	2026-07-10 22:48:33.589506	300.00	300.00	\N
19	Rewinder Section	RS13	Rewinder	100.00	t	2026-07-10 22:48:33.592349	300.00	300.00	\N
20	Starch kitchen Section	SKS14	Paper Machine	100.00	t	2026-07-10 22:48:33.596458	300.00	300.00	\N
21	Steam & Condensate Section	S&C15	Paper Machine	100.00	t	2026-07-10 22:48:33.600264	300.00	300.00	\N
22	ETP Section	ES16	ETP	100.00	t	2026-07-10 22:48:33.602669	300.00	300.00	\N
23	Boiler Section	BS17	Boiler	100.00	t	2026-07-10 22:48:33.605176	300.00	300.00	\N
24	Lab Section	LS18	Other	100.00	t	2026-07-10 22:48:33.608086	300.00	300.00	\N
25	Cranes	C19	Other	100.00	t	2026-07-10 22:48:33.610452	300.00	300.00	\N
26	Compressors & Air Dryer	C&A20	Compressor	100.00	t	2026-07-10 22:48:33.613008	300.00	300.00	\N
27	Store Section	SS21	Other	100.00	t	2026-07-10 22:48:33.615214	300.00	300.00	\N
\.


--
-- Data for Name: maintenance_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_logs (id, schedule_id, machine_id, date, maintenance_type, description, work_done, spare_parts_used, start_time, end_time, duration_hours, cost, performed_by, status, created_at) FROM stdin;
1	\N	1	2026-07-10	Breakdown	test	\N	[]	\N	\N	\N	\N	1	In Progress	2026-07-10 21:31:02.99173
\.


--
-- Data for Name: maintenance_schedule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_schedule (id, machine_id, maintenance_type, title, frequency_days, last_done, next_due, estimated_hours, assigned_to, status, created_at, position_id, materials_needed, priority) FROM stdin;
\.


--
-- Data for Name: material_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.material_categories (id, name, code, type) FROM stdin;
28	Chemical	CHEM	Raw Material
29	Clothing	CLOTH	Consumable
30	Electrical	ELEC	Spare Part
31	Mechanical	MECH	Spare Part
32	Spare Parts	SPARE	Spare Part
33	Stationary	STAT	Consumable
34	Packing	PACK	Consumable
35	General	GEN	Consumable
36	Hydraulic & Pneumatic	HYDPNEU	Spare Part
37	Drive & Motors	DRIVE	Spare Part
38	Capital Goods	CAPEX	Asset
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.materials (id, code, name, category_id, uom, hsn_code, reorder_level, min_stock, max_stock, current_stock, unit_price, is_active, created_at, is_serialized, expected_lifespan_days, section_context, criticality_class, procurement_strategy, oem_supplier, last_audit_cycle, calibration_protocol, reorder_buffer, deleted_by, bin_location) FROM stdin;
2054	OS0001	10-22-7	31	Nos	4016 9330	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2055	OS0002	20-32-7	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2056	OS0004	20-52-7	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2057	OS0005	25-40-8	31	Nos	4016 9330	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2058	OS0007	25-42-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2059	OS0008	25-45-10	31	Nos	4016 9330	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2060	OS0009	25-52-7	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2061	OS0010	25-62-7	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2062	OS0011	28-38-7/2	31	Nos	4016 9330	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2063	OS0012	30-47-7/10	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2064	OS0013	30-62-10	31	Nos	4016 9330	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2065	OS0014	32-45-7	31	Nos	4016 9330	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2066	OS0015	32-52-10	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2067	OS0016	32-60-10	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2068	OS0017	35-47-7	31	Nos	4016 9330	5.000	5.000	0.000	25.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2069	OS0018	35-52-10	31	Nos	4016 9330	2.000	2.000	0.000	12.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2070	OS0019	35-55-10	31	Nos	4016 9330	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2074	OS0023	45-55-8	31	Nos	4016 9330	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2076	OS0025	45-65-10/12	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2077	OS0026	45-75-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2078	OS0027	48-62-10	31	Nos	4016 9330	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2079	OS0028	50-65-8	31	Nos	4016 9330	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2080	OS0029	50-70-10	31	Nos	4016 9330	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2081	OS0030	50-72-8/10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2083	OS0033	55-70-10	31	Nos	4016 9330	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2085	OS0035	55-75-10	31	Nos	4016 9330	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2086	OS0036	55-80-10	31	Nos	4016 9330	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2088	OS0039	65-75-10	31	Nos	4016 9330	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	5
2089	OS0040	65-80-10	31	Nos	4016 9330	3.000	3.000	0.000	13.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	5
2090	OS0041	65-85-10	31	Nos	4016 9330	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2091	OS0042	65-90-10/12	31	Nos	4016 9330	2.000	2.000	0.000	12.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	5
2092	OS0043	65-95-10	31	Nos	4016 9330	3.000	3.000	0.000	16.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	5
2093	OS0044	70-80-10	31	Nos	4016 9330	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	4
2094	OS0045	70-90-10	31	Nos	4016 9330	4.000	4.000	0.000	19.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2095	OS0047	75-95-10	31	Nos	4016 9330	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	4
2097	OS0048	80-100-10	31	Nos	4016 9330	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2098	OS0049	80-105-10/12	31	Nos	4016 9330	3.000	3.000	0.000	14.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2099	OS0050	85-100-10/12	31	Nos	4016 9330	3.000	3.000	0.000	14.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2100	OS0051	85-105-10	31	Nos	4016 9330	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2101	OS0052	85-110-10	31	Nos	4016 9330	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2102	OS0053	85-115-10	31	Nos	4016 9330	4.000	4.000	0.000	18.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2103	OS0054	90-110-10/12	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2104	OS0055	90-115-10	31	Nos	4016 9330	2.000	2.000	0.000	11.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2105	OS0056	90-120-12	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2107	OS0058	107-135.5-10	31	Nos	4016 9330	4.000	4.000	0.000	18.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2108	OS0059	110-130-12	31	Nos	4016 9330	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	4
2109	OS0060	115-140-15	31	Nos	4016 9330	2.000	2.000	0.000	9.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	4
2110	OS0061	140-170-15	31	Nos	4016 9330	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	8
2111	OS0062	145-165-13	31	Nos	4016 9330	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	8
2112	OS0063	155-180-15	31	Nos	4016 9330	2.000	2.000	0.000	9.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	8
2114	OS0065	55-72-12	31	Nos	4016 9330	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2115	OS0066	55-60-8	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2116	OS0067	22-40-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2117	OS0068	20-52-8	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2118	OS0069	40-65-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2119	OS0070	45-55-10	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2072	OS0021	40-60-10	31	Nos	4016 9330	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2073	OS0022	42-55-10	31	Nos	4016 9330	2.000	2.000	0.000	9.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2075	OS0024	45-60-10	31	Nos	4016 9330	2.000	2.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	2
2082	OS0031	50-75-12/10	31	Nos	4016 9330	2.000	2.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2084	OS0034	55-72-10/8	31	Nos	4016 9330	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2087	OS0037	60-80-10	31	Nos	4016 9330	2.000	2.000	0.000	11.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	5
2106	OS0057	95-120-10	31	Nos	4016 9330	3.000	3.000	0.000	12.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	3
2113	OS0064	185*215*15	31	Nos	4016 9330	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	8
2120	OS0071	78-100-10	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2122	OS0073	150-180-15	31	Nos	4016 9330	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	8
2123	OS0074	65-100-1	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	7
2124	OS0075	20-35-7	31	Nos	4016 9330	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	0
2125	OS0076	25-42-10	31	Nos	4016 9330	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	0
2127	OS0078	60-90-10	31	Nos	4016 9330	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	0
2128	BE0001	2213-K-TVH-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2129	BE0002	3210 -BD-XL	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2131	BE0004	3307 -BD-XL	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2132	BE0005	6001-c-2hrs /2z/C3	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2133	BE0006	6003 -2z	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2136	BE0009	6009-2RSR/LLU/ZZ	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2137	BE0010	6011-2rs	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2139	BE0012	6201-2Z	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2140	BE0013	6202-2Z-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2146	BE0019	6207-2z	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2147	BE0020	6208	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2152	BE0025	6212-2z-L140	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2153	BE0026	6212-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2154	BE0027	6213 -2Z -L140 -C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2155	BE0028	6215-2rs/2z	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2156	BE0029	6215-c3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2157	BE0030	6302-2z	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2158	BE0031	6303-2z	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2160	BE0033	6305-2Z	31	Nos	\N	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2162	BE0035	6307 -zz/ 2Z C3	31	Nos	\N	2.000	2.000	0.000	9.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2166	BE0039	6311-2z	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2167	BE0040	6312- H-SN-C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2168	BE0041	6312-2z -L140 /6310-2Z-C3	31	Nos	\N	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2169	BE0042	6313-2Z -L140- C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2170	BE0043	6313-c3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2171	BE0044	6314-H-SN /6314-C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2172	BE0045	6315-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2173	BE0046	6316-C3	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2174	BE0047	6318-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2175	BE0048	6319-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2176	BE0049	6321-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2177	BE0050	6322-C3	31	Nos	\N	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2178	BE0051	6404-A	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2179	BE0052	6405	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2180	BE0053	6406	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2181	BE0054	6407	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2182	BE0055	7206-B-XL -TVP	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2183	BE0056	7313 BEP -XL TVP	31	Nos	\N	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2184	BE0057	7314 BEP	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2185	BE0058	7319 B-XL-MP	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2186	BE0059	22215-E-XL-C3	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2187	BE0060	22216 E1-XL	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2188	BE0061	22218 E1-XL-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2135	BE0008	6008- 2Z	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2138	BE0011	6012	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2141	BE0014	6203-C-HRS 2Z	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2142	BE0015	6204 -C HRS	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2143	BE0016	6204-zz /6204- 2RS	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2144	BE0017	6205-zz /2RS	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2145	BE0018	6206-2z	31	Nos	\N	2.000	2.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2148	BE0021	6208-2Z- C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2149	BE0022	6209-zz	31	Nos	\N	1.000	1.000	0.000	13.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2150	BE0023	6210	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2151	BE0024	6210- 2z	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2159	BE0032	6304-2Z /2RS1	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2161	BE0034	6306-2z /L207-C3	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2163	BE0036	6308-zz	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2164	BE0037	6309-zz	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2165	BE0038	6310-2z -C3/6310-2Z/R	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2121	OS0072	60-85-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	6
2126	OS0077	50-80-10	31	Nos	4016 9330	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	0
2189	BE0062	22219 -E1-XL	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2190	BE0063	22220 E1-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2192	BE0065	22222 e1 AM C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2193	BE0066	22222 E1 XL	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2194	BE0067	22222 E1-XL-K	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2195	BE0068	22224 E1-XL	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2196	BE0069	22228 E1-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2197	BE0070	22311 CW 33C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2198	BE0071	22312 MBW33 C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2199	BE0072	22314 -E1-XL	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2200	BE0073	22314 KW33 M	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2201	BE0074	22315-E1-XL-K-C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2202	BE0075	22316 E1-XL	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2203	BE0076	22316-E1-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2204	BE0077	22318-E1-XL-K-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2205	BE0078	22319 -E	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2206	BE0079	22320- E1-XL-C3	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2207	BE0080	22320 E1-XL-K	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2208	BE0081	22322 E1-XL - C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2209	BE0082	22322 E1-XL - K C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2210	BE0083	22322 E1-XL --C3	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2211	BE0084	22324-E1-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2213	BE0086	2312 TVH C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2214	BE0087	23124 E1AM	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2215	BE0088	23220 E1 AM	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2216	BE0089	23222 E1 A-XL-K-M-C3	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2217	BE0090	23226 E1 AM	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2218	BE0091	23234 BS-K -MB-C3	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2219	BE0092	23234 E1 A-K-M	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2220	BE0093	23244 -BE-XL-K	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2221	BE0094	23264 -BEA-XL-K- MB1-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2224	BE0097	29240 E MB	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2225	BE0098	29418 -E1-XL-C3	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2226	BE0099	29420 E1-XL	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2227	BE0100	30204 -A	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2228	BE0101	30206 -A	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2229	BE0102	30216-A	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2230	BE0103	30305 CYC	31	Nos	\N	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2231	BE0104	30306 -A	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2232	BE0105	30310 A	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2234	BE0107	31316	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2235	BE0108	32212- A J2 /Q	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2236	BE0109	32213-A	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2237	BE0110	32214-AM	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2238	BE0111	32216- A-AM	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2239	BE0112	32305 J2 /Q	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2240	BE0113	32310-H	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2241	BE0114	32313-H	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2242	BE0115	51105	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2243	BE0116	51211	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2244	BE0117	51212	31	Nos	\N	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2246	BE0119	F-573288.24032 -S-K30-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2247	BE0120	FC 210	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2248	BE0121	GEM 020	31	Nos	\N	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2249	BE0122	HB 209	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2250	BE0123	N 407 EM	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2251	BE0124	NA 4905	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2252	BE0125	NJ 303 E- XL -TVP2	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2253	BE0126	NJ205	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2254	BE0127	NJ313 -E-XL-M1-QP-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2255	BE0128	NU 2320 E-XL -M1QP-C3	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2256	BE0129	NU 2320 INNER	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2212	BE0085	23044 BE-XL-K	31	Nos	\N	2.000	2.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2222	BE0095	24032-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2223	BE0096	24184 cck/w33	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2233	BE0106	30312 A	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2245	BE0118	F-573288.24032 -S-	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2257	BE0130	NU 2322 E1-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2258	BE0131	NU 2322 EM ZVL	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2259	BE0132	NU 315 E-XL -M1QP-C3	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2261	BE0134	NU 322 E1-XL M1QP -C3	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2262	BE0135	NU2217 -E-XL-M1-QP	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2263	BE0136	NU2220 E1 -AM-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2264	BE0137	NU307	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2265	BE0138	NU309-XL -C3	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2266	BE0139	NU310 E-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2267	BE0140	NU313 -E-XL M1 -QP-C3	31	Nos	\N	2.000	2.000	0.000	9.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2268	BE0141	NU319 E-XL -M1-QP -C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2269	BE0142	NU320 E-XL-M1-QP-C3 -2 old side	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2270	BE0143	NUP 313 E TVP2	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2272	BE0145	SYJ 513	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2273	BE0146	SYJ 517	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2274	BE0147	UC 210	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2275	BE0148	UC 211 -23	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2276	BE0149	UC 211 -32	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2277	BE0150	UC 215	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2278	BE0151	UC206	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2279	BE0152	UC208	31	Nos	\N	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2280	BE0153	UCF 209 -J7	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2281	BE0154	UCF 210 (mm) /UCF 210 -K	31	Nos	\N	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2282	BE0155	UCF 211 D1	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2283	BE0156	UCF 211 J7-32	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2284	BE0157	UCF-206	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2285	BE0158	UCFC 210	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2286	BE0159	UCFC-208 -J7	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2287	BE0160	UCFL 208	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2288	BE0161	UCP 206- J7 -NTN	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2289	BE0162	UCP 207	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2290	BE0163	UCP 208-J5	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2291	BE0164	UCP 209	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2292	BE0165	UCP 210	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2293	BE0166	UCP 211	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2294	BE0167	UCP 212 D1	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2296	BE0169	UCP215	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2300	PF0001	PRESS FELTS (14.1*3.5 M) 1650 GSM V3 (81.43 KGS) ,12579028	29	Nos	5911-9010	1.000	1.000	0.000	1.000	243858.71	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2301	DS0001	DRYER SCREEN (29*3.5 M) -SHALIMAR-18164	29	Nos	5911-2000	1.000	1.000	0.000	1.000	158847.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2302	DS0002	DRYER SCREEN (32*3.5 M) shalimar-18163 ,18165	29	Nos	5911-2000	1.000	1.000	0.000	2.000	175280.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2305	PF0004	NEW PRESS FELTS BOTTOM( 15.1* 3.5 M) 1650 ,voith 12507946, (89.55) 12759027	29	Nos	5911-9010	1.000	1.000	0.000	2.000	261152.62	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2306	TF0001	TYRE F-45	31	Nos	4012-9010	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2307	TF0002	TYRE F-70	31	Nos	4012-9010	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2308	TF0003	TYRE F-90	31	Nos	4012-9010	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2309	TF0004	TYRE F-160	31	Nos	4012-9010	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2310	TP0001	TYRE PH-126	31	Nos	4012-9010	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2311	TP0002	TYRE PH-140	31	Nos	4012-9010	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2312	TP0003	TYRE PH-160	31	Nos	4012-9010	1.000	1.000	0.000	7.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2313	TP0004	TYRE PH-178	31	Nos	4012-9010	2.000	2.000	0.000	8.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2314	TP0005	TYRE PH-190	31	Nos	4012-9010	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2315	TP0006	TYRE PH-250	31	Nos	4012-9010	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2316	TCF0001	TYRE COUPLING F-70	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2317	TCP0002	TYRE COUPLING PH-106	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2318	TCP0003	TYRE COUPLING PH-140	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2319	TCP0004	TYRE COUPLING PH-160	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2320	TCP0005	TYRE COUPLING PH-178	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2271	BE0144	QJ 317 -N2-MPA-C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2295	BE0168	UCP 213	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2297	BE0170	ZVL 23044 KW33MC3	31	Nos	\N	1.000	1.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2299	BW0001	BOTTOM WIRE (44.953*3.65)- (1.5 LAYER) SHALIMAR -48498,W&F -60216	29	Nos	5911-2000	1.000	1.000	0.000	1.000	507516.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2304	PF0003	NEW PRESS FELTS TOP ( 15.1* 3.5 M) 1450 , WT: 79.28 (12559803, 12579025, 9026)	29	Nos	5911-9010	1.000	1.000	0.000	2.000	230430.49	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2303	URG001	1 ST UNIRUN GROUP 42*3.5	29	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2321	TCP0006	TYRE COUPLING PH-190	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2322	TCP0007	TYRE COUPLING PH-250	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2323	CPB0001	FBC-6A4 (OD-254, 10 HPLES)	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2324	CPB0002	FBC-5L (6 HOLES)	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2325	CPB0003	FGC2-0.5L GARE COUPALING PART(OD-185, 6 HOLES)	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2326	CPB0004	FGC1-0.5L GEAR COUPALING PART(OD-170, 6 HOLES)	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2327	MPS0001	SWP 80/260	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2328	MPS0002	MEGA A 40	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2329	MPS0003	SEPRATOR SLEEVE 25*32*75 MM	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2330	MPS0004	OD-38 mm -108 LENGTH	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2331	MPS0005	CPC 65/260	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2332	MPS0006	CPC 150/320	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2334	MPS0008	VSL 04 SLEEVE	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2335	MPS0009	TURBO 900 SLEEVE	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2337	MPS0011	TPR 80 /320	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2339	MPS0013	AAPGC 42/150	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2341	MPS0015	TPR 150/320	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2343	MPS0017	SPR + T125/260	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2344	MPS0018	SPR + T125 /330	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2345	MPS0019	CPC 50 /320	31	Nos	\N	1.000	1.000	0.000	0.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2347	MPS0021	AGITATOR SLEEVES	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2348	MPS0022	AFT PRESSURE SCREEN SLEEVE (OD90XID70XLE229/230)	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2349	MPS0023	GUN METAL(OD50XID75XLE210 MM)  /S.S 316 (ID63XID70XLE130 MM) -BOTTOM FAN PUMP	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2351	MPS0025	PULPER SLEEVE	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2352	MPS0026	BOTTOM FAN PUMP SLEEVE	31	Nos	\N	1.000	1.000	0.000	4.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2130	BE0003	3309	31	Nos	\N	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2134	BE0007	6004-2z	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2191	BE0064	22220 E1-XL	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2260	BE0133	NU 317 -M1QP -C3	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2071	OS0020	40-55-8	31	Nos	4016 9330	1.000	1.000	0.000	5.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	1
2333	MPS0007	ETP SLEEVE	31	Nos	\N	1.000	1.000	0.000	1.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2336	MPS0010	TPR 125/400+C (3VO)	31	Nos	\N	2.000	2.000	0.000	10.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2338	MPS0012	TPR 250+400+C	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2340	MPS0014	TURBO SLEEVE 400	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2342	MPS0016	cpc 100/320	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2346	MPS0020	VSL -08 SLEEVE	31	Nos	\N	1.000	1.000	0.000	3.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2350	MPS0024	SPR +T 125/320 SLEEVE	31	Nos	\N	1.000	1.000	0.000	2.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2353	MPS0027	HOLY ROLL SLEEVE	31	Nos	\N	1.000	1.000	0.000	6.000	0.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2298	TW0001	TOP WIRE (20.250* 3.65 M) SHALIMAR -48497, W&F - 60215	29	Nos	5911-2000	1.000	1.000	0.000	1.000	235171.00	t	2026-07-15 18:39:14.282141	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2654	BE0171	626 BEARING	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2655	BE0172	608 BEARING	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2656	BE0173	627 BEARING	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2657	MVB0001	V-BELT SPB 1850	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2658	MVB0002	V-BELT GREEN SPB -PT 3150	31	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2659	MVB0003	V-BELT BLACK SP 3300	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2660	MVB0004	V- BELT GREEN SPC-PT 3750 /BLACK SPC 3750	31	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2661	MVB0005	V-BELTBLACK SPB 4250 /GREEN SPB-PT 4250	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2662	MVB0006	V-BELTBLACK SPC 4300	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2663	MVB0007	GREEN SPC -PT 4500	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2664	MVB0008	GREEN & BLACK SPC-PT 4750	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2665	MVB0009	GREEN SPC 5300	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2666	MVB0010	GREEN SPC -PT 6000 /BLACK SPC-PT 6000	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2667	MVB0011	BLACK SPC 8500/ GREEN SPC -8500	31	Nos	\N	0.000	0.000	0.000	11.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2668	MVB0012	BLACK XPA 1120	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2669	MVB0013	BLACK XPA 1450	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2670	MVB0014	BLACK B 47	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2671	MVB0015	BLACK C48	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2672	MVB0016	BLACK A 49	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2673	MVB0017	BLACK B50	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2674	MVB0018	BLACK B 58	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2675	MVB0019	BLACK B 62	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2676	MVB0020	BLACK C 73	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2677	MVB0021	GREEN SPA -PT 1220	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2678	MVB0022	BLACK SPB 1600	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2679	MVB0023	BLACK C 107/C 2774	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2680	MVB0024	BLACK B 68	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2681	MVB0025	BLACK C 114/C2952	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2682	MVB0026	BLACK C 103	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2683	MVB0027	BLACK C 104	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2705	MV0001	1.5 " GLOBE VALVE	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2706	MV0002	0.5" PISTON VALVES/ BELLOW SEAL GLOBE VALVE	31	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2707	MV0003	1" PISTION VALVES/BELLOW SEAL GLOBE VALVE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2708	MV0004	C.I BODY S.S DISC BUTTERFLY VALVE 2"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2709	MV0005	C.I BODY S.S DISC BUTTERFLY VALVE 2.5"	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2710	MV0006	C.I BODY S.S DISC BUTTERFLY VALVE 3"	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2711	MV0007	C.I BODY S.S DISC BUTTERFLY VALVE 4"	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2712	MV0008	C.I BODY S.S DISC BUTTERFLY VALVE 6"	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2713	MV0009	C.I BODY S.S DISC BUTTERFLY VALVE 8"	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2714	MV0010	C.I BODY S.S DISC BUTTERFLY VALVE 12"	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2715	MV0011	S.S 304 BALL VALVE WITH FLANGE 1'	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2716	MV0012	S.S 304 BALL VALVE WITH FLANGE 1' 1/2" (40 MM)	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2717	MV0013	S.S 304 BALL VALVE WITH FLANGE 2'	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2718	MV0014	S.S 304 BALL VALVE WITH FLANGE 2' 1/2"	31	Nos	\N	0.000	0.000	0.000	17.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2719	MV0015	S.S BALL VALVE WITH 4" (100MM)	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2720	MV0016	PLATE VALVE 3" (KNIFE GATE VALVE)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2721	MV0017	PLATE VALVE 4" (KNIFE GATE VALVE)	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2722	MV0018	PLATE VALVE 5" (KNIFE GATE VALVE)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2723	MV0019	PLATE VALVE 6" (KNIFE GATE VALVE)	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2724	MV0020	PLATE VALVE 8" (KNIFE GATE VALVE)	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2725	MV0021	S.S NEEDLE VALVE 1/2"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2726	MV0022	S.S BALL VALVE 8/10MM	31	Nos	\N	0.000	0.000	0.000	18.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2727	MV0023	S.S BALL VALVE 3/8"	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2728	MV0024	S.S BALL VALVE 6MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2729	MV0025	S.S BALL VALVE 15MM	31	Nos	\N	0.000	0.000	0.000	17.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2730	MV0026	S.S BALL VALVE 20MM (3/4)	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2731	MV0027	S.S BALL VALVE 25MM / C.I BALL VALVE	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2732	MV0028	S.S BALL VALVE 32MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2733	MV0029	S.S BALL VALVE 40MM	31	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2734	MV0030	S.S BALL VALVE 50MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2735	MV0031	2 1/2" PISTON VALVE	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2736	MV0032	S.S DISC CHECK VALVE 1 1/2"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2737	MV0033	C.I WAFER CHECK VALVE -4"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2738	MV0034	4" FOOT VALVE	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2739	MV0035	1" BLOW DOWN VALVE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2740	MV0036	1.5" BLOW DOWN VALVE	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2741	MV0037	3' GLOBE VALVE / NRV (BOILER)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2742	MNRV001	SS PLATE NRV 25 MM	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2743	MNRV002	SS PLATE NRV 40 MM	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2744	MNRV003	SS PLATE NRV 50 MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2745	MNRV004	SS PLATE NRV 80 MM	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2746	MNRV005	SS PLATE NRV 100 MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2747	MNRV006	SS PLATE NRV 150 MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2748	MNRV007	CI PLATE NRV 65 MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2749	MNRV008	CI PLATE NRV 80 MM	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2750	MNRV009	CI PLATE NRV 100 MM	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2751	MV0038	S.S DISC CHECK VALVE 25 MM	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2752	MV0039	S.S DISC CHECK VALVE 40 MM	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2753	MV0040	S.S DISC CHECK VALVE 50 MM	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2754	MV0041	S.S DISC CHECK VALVE 80 MM	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2755	MV0042	S.S DISC CHECK VALVE 100 MM	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2756	MV0043	3" PLATE VALVE	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2757	MCNW0001	CHECKNUT WASHER MB 09	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2758	MCNW0002	CHECKNUT WASHER MB 12	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2759	MCNW0003	CHECKNUT WASHER MB 13	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2760	MCNW0004	CHECKNUT WASHER MB 14	31	Nos	\N	0.000	0.000	0.000	29.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2761	MCNW0005	CHECKNUT WASHER MB 16	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2762	MCNW0006	CHECKNUT WASHER MB 18	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2763	MCNW0007	CHECKNUT WASHER MB 19	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2764	MCNW0008	CHECKNUT WASHER MB 20	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2765	MCNW0009	CHECKNUT WASHER MB 21	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2766	MCNW0010	CHECKNUT WASHER MB 22	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2767	MCNW0011	CHECKNUT WASHER MB 24	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2768	MCNW0012	CHECKNUT WASHER MB 40	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2769	MCNW0013	CHECKNUT WASHER MB 44	31	Nos	\N	0.000	0.000	0.000	23.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2770	MCNW0014	CHECKNUT LOCK KM -09	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2771	MCNW0015	CHECKNUT LOCK KM -12	31	Nos	\N	0.000	0.000	0.000	11.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2772	MCNW0016	CHECKNUT LOCK KM -13	31	Nos	\N	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2773	MCNW0017	CHECKNUT LOCK KM -14	31	Nos	\N	0.000	0.000	0.000	29.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2774	MCNW0018	CHECKNUT LOCK KM -16	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2775	MCNW0019	CHECKNUT LOCK KM -18	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2776	MCNW0020	CHECKNUT LOCK KM -19	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2777	MCNW0021	CHECKNUT LOCK KM -20	31	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2778	MCNW0022	CHECKNUT LOCK KM -21	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2779	MCNW0023	CHECKNUT LOCK KM -22	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2780	MCNW0024	CHECKNUT LOCK KM -24	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2781	MCNW0025	CHECKNUT LOCK KM -32	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2782	MCNW0026	CHECKNUT LOCK KM -315	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2783	MGU0001	Pressue Guage 0 to 16 kg/cm2 (150mmX1/2" BSP)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2784	MGU0002	Messureing Guage 0 to 28 kg cm /2, 0 to 400  (12"X 1/2" BSP)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2785	MGU0003	Messuring Guage 150mmx1/2" mm bar/mm wc -100/1000	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2786	MGU0004	Messuring Guage 0 to 40 kg /cm2 PSI (100mmx1/2" BSP)	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2787	MGU0005	Messuring Guage 0 to 10 kg /cm2 PSI (100mmx1/2" NPT)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2788	MGU0006	Messuring Guage 0 to 7 kg /cm2 PSI (80mmx3/8" BSP)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2789	MGU0007	Messuring Guage 0 to 7 (lb/in2) /(kg /cm2)FM (25MMX1/4 BSP)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2790	MGU0008	Messuring Guage 0 to 140 kg /cm2 (25MMX1/4 )	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2791	MGU0009	Messuring Guage 0 to 10 kg /cm2 (25MMX1/4 BSP)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2792	MGU0010	Messuring Guage 0 to 6 kg /cm2 FM (150MMX1/2" BSP	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2793	MGU0011	OXYGEN REGULATER DOUBLE GUAGE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2794	MGU0012	Temperature Guage 0 to 200 C  (BAUMER MAKE)	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2795	MGU0013	Temperature Guage 0 to 300 C (P163.59-00160)-150MM-1/2" BSP	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2796	MGU0014	Vaccum Gauge 0 to 760 mm Hg 1/2" Bspt Dial 6"	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2797	MIMP001	CPC 100/320 WITH CHECKNUT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2798	MIMP002	SPR+T 125/330	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2799	MIMP003	SPR+T 125/260	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2800	MIMP004	SPR +T 125/400	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2801	MIMP005	WP 80/260	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2802	MIMP006	CPC 150 -320	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2803	MIMP007	CPC 65-260	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2804	MIMP008	TPR 80/320 (OPEN IMPELLER)	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2805	MIMP009	APPC 42 /150	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2806	MIMP010	TPR 125/400 (3VO)	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2807	MIMP011	SEPRATOR	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2808	MIMP012	SPR+T 125/260 WEAR PLATE /SIDE PLATE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2809	MIMP013	SPR+T 125/260 GLAND COVER (5VO)	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2810	MIMP014	SPR+ T125/260 STUFFING BOX	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2811	MIMP015	SPR+ T125/330 STUFFING BOX	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2812	MIMP016	SWP 125/320	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2813	MIMP017	SPR+T 125/260 CASING COVER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2814	MIMP018	APPC 42 /150 WEAR PLATE -1SET	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2815	MIMP019	CPC 125/320 IMPELLER	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2816	MIMP020	TURBO 400 IMPELLER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2817	MIMP021	TURBO 400 SCREEN PLATE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2818	MIMP022	CPC 100/320 BEARING BED /HOUSING	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2819	MIMP023	CPC 100/320 CAP OUTER ,	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2820	MIMP024	CPC 100/320 CAP INNER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2821	MIMP025	SPR +T 125/330 CAP OUTER SAM TURB ( PART NO: 37.21 )	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2822	MIMP026	SPR +T 125/330 CAP INNER	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2823	MIMS001	CPC 100/320 SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2824	MIMS002	SPR+T 125/260 SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2825	MIMS003	SPR+T 125/330 SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2826	MIMS004	SPR + T 125 /400 (4 VO) SHAFT	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2827	MIMS005	WP 80/260 SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2828	MIMS006	CPC 150 -320 -SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2829	MIMS007	CPC 65-260 (EN19) -SHAFT	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2830	MIMS008	TPR 80/320 SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2831	MIMS009	APPC 42 /150 SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2832	MIMS010	TPR 125/400 (3VO) SHAFT	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2833	MIMS011	SEPRATOR SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2834	MIMS012	TURBO SHAFT -SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2835	MIMS013	SWP +125/320 SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2836	MIMS014	KSB PUMP SHAFT (EN 19) SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2837	MIMS015	BOTTOM FAN PUMP SHAFT	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2838	MIMS016	PULP MILLL AFT PRESSURE SCREEN SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2839	MIMS017	VSL-08 PRESSURE SCREEN SHAFT	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2840	SSR0001	SUPERON S.S (3.15X350 MM) PKT	35	Pkt	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2841	SSR0002	SUPERON S.S (2.5X350 MM) PKT	35	Pkt	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2842	MSR0001	MANGLAM M.S (2.50X350 MM) PKT	35	Pkt	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2843	MSR0002	MANGLAM M.S (3.15X350 MM) PKT	35	Pkt	\N	0.000	0.000	0.000	17.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2844	MSR0003	MANDLAM M.S (4.00X450 MM) PKT	35	Pkt	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2845	TWE0001	TUNGSTEN WELDING ELECTRODES 2.44MM	35	Pkt	\N	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2846	TWE0002	TUNGSTEN WELDING ELECTRODES 3MM	35	Pkt	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2847	DB0001	DOCTOR BLADE 1.2X75X3600 MM RSE -BRONZE	35	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2848	DB0002	DOCTOR BLADE 6.0X75X4000 MM PLASTIC GREEN	35	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2849	DB0003	DOCTOR BLADE 2X75X3350 MM PLASTIC	35	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2850	GBW0001	4" BUFFIN WHEEL	35	Nos	\N	0.000	0.000	0.000	64.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2851	GGW0001	4" GRINDING WHEEL	35	Nos	\N	0.000	0.000	0.000	59.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2852	GCW0001	4" CUTT OFF WHEEL	35	Nos	\N	0.000	0.000	0.000	200.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2853	GCW0002	7" CUTT OFF WHEEL	35	Nos	\N	0.000	0.000	0.000	40.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2854	GGW0002	7" GRINDING WHEEL	35	Nos	\N	0.000	0.000	0.000	29.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2855	GEP0001	EMERY PAPER 36 GRIT -75 MM	35	Nos	\N	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2856	GEP0002	EMERY PAPER 60 GRIT -75 MM	35	Nos	\N	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2857	GRK0001	REWINDER KNIVES	35	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2858	GRC0001	REWINDER CUTTER	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2859	LGO0001	SERVO GEAR OIL 320	31	Ltr	\N	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2860	LGR0001	SERVO GREASE MP3	31	Kgs	\N	0.000	0.000	0.000	120.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2861	LGR0002	SG 350 E.P MOLY GREASE HIGH TEMP	31	Kgs	\N	0.000	0.000	0.000	75.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2862	LHO0001	HYDRULIC OIL No: 68	31	Ltr	\N	0.000	0.000	0.000	60.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2863	LLOC001	LUBRICANTING OIL CAN (REUSE)	31	Ltr	\N	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2864	MNO001	ROBO NOZZLE 0.4MM	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2865	MNO002	ROBO NOZZLE 0.7MM	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2866	MNO003	3/64 GAS CUTTER NOZZLE	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2867	MNO004	1/16 GAS CUTTER NOZZLE	31	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2868	MNO005	1/32 GAS CUTTER NOZZLE	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2869	PCK0001	50mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2870	PCK0002	80mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2871	PCK0003	100mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2872	PCK0004	125mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2873	PCK0005	150mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2874	PCK0006	200mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2875	PCK0007	250mm CYLINDER KITS	36	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2876	PCK0008	Spare penumatics Air max seal kit (200mm -214 mm) SHAFT SIZE :38MM	36	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2877	PUE0009	10X1/2" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2878	PUM0005	10X1/2" PU MALE CONNECTOR	36	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2879	PUM0009	10X1/2" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	24.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2880	PUM0001	10X1/4" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	41.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2881	PUE0006	10X1/8" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2882	PUM0013	10X1/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2883	PUC0002	10X10 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	60.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2884	PUT0002	10X10X10 PU T CONNECTOR	36	Nos	\N	0.000	0.000	0.000	24.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2885	PUC0003	10X12 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	43.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2886	PUM0011	10X3/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	29.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2887	PUM0014	12X1/2" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2888	PUC0006	12X12 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2889	PUT0004	12X12X12 PU T CONNECTOR	36	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2890	PUM0012	4X3/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	13.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2891	PUE0001	6X1/2" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2892	PUM0002	6X1/2" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	60.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2893	PUE0007	6X1/4" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	43.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2894	PUM0003	6X1/4" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	11.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2895	PUE0003	6X1/8" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	11.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2896	PUE0008	6X3/8" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	34.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2897	PUM0004	6X3/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	71.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2898	PUC0007	6X6 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	39.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2899	PUT0003	6X6X6 PU T CONNECTOR	36	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2900	PUC0004	6X8 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2901	PUM0008	8X1/2" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2902	PUE0005	8X1/4" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	27.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2903	PUM0006	8X1/4" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	210.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2904	PUE0004	8X1/8" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	66.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2905	PUM0010	8X1/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	80.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2906	PUC0008	8X10 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	46.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2907	PUC0005	8X12 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	47.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2908	PUE0002	8X3/8" PU ELBOW CONNECTOR	36	Nos	\N	0.000	0.000	0.000	66.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2909	PUM0007	8X3/8" PU MAIL CONNECTOR	36	Nos	\N	0.000	0.000	0.000	32.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2910	PUC0001	8X8 PU COUPLER	36	Nos	\N	0.000	0.000	0.000	169.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2911	PUT0001	8X8X8 PU T CONNECTOR	36	Nos	\N	0.000	0.000	0.000	18.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2912	PUTU001	Polyurethane Tubes 4 x 2.5 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2913	PUTU002	Polyurethane Tubes 4 x 2 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2914	PUTU003	Polyurethane Tubes 6 x 4 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2915	PUTU004	Polyurethane Tubes 8 x 5 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2916	PUTU005	Polyurethane Tubes 10 x 6.5 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2917	PUTU006	Polyurethane Tubes 8 x 6 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2918	PUTU007	Polyurethane Tubes 10 x 8 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2919	PUTU008	Polyurethane Tubes 12 x 10 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2920	PUTU009	Polyurethane Tubes 12 x 8 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2921	PUTU010	Polyurethane Tubes 14 x 11 mm 100 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2922	PUTU011	Polyurethane Tubes 16 x 12 mm 50 mts	36	Mtr	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2923	PFRL001	3 /8" FR+L (JHFRCLM-14B) AIRMAX	36	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2924	PFRL002	1/2 "FR+L (JHFRCLM-15) AIRMAX	36	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2925	PREG001	3/8" REGULATOR (MO NO:R14624)	36	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2926	PREG002	1/2" REGULATOR ( R15634) AIRMAX	36	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2927	PNCV001	1/8-3/2" NC VALVE & SWITCH (JANATICS) MOUNTING VALVE	36	Nos	\N	0.000	0.000	0.000	14.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2928	PCV0001	1/4" COMPACT VALVE  (DS265SC61-W)-JANATICS	36	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2929	PDV0001	1/4" DISC ROTARY VALVE	36	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2930	PDV0002	1/2" DISC ROTARY VALVE	36	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2931	PRV0001	1/2" ROTARY VALVE	36	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2932	PCV0002	1/4" COMPACT VALVE  (DS255ER61)-JANATICS	36	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2933	PSM001	PNEUMATIC PP & PET STRAPPING MACHINE MODEL: XQD-19	36	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2934	PSM002	PNEUMATIC PP & PET STRAPPING MACHINE MODEL: AQD-19	36	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2935	PSH001	PNEUMATIC SHAFT 100 X 50 MM	36	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2936	PBR001	PNEUMATIC BAREL 100 X 50 MM	36	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2937	PCY001	PNEUMATIC CYLENDER 100 X 850 MM	36	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2938	PCY002	PNEUMATIC CYLENDER 80 X 1050 MM	36	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2939	GECR001	LIFT SLING BELT 3TON X 3 MTR	35	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2940	GECR002	LIFT SLING BELT 3TON X 4 MTR	35	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2941	GECR003	LIFT SLING BELT 3TON X 5 MTR	35	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2942	GECR004	CRANE REMOTE	35	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2943	GEGR001	GLAND ROPE 6MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2944	GEGR002	GLAND ROPE 8MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2945	GEGR003	GLAND ROPE 10MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2946	GEGR004	GLAND ROPE 12MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2947	GEGR005	GLAND ROPE 16MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2948	GEGR006	GLAND ROPE 18MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2949	GEGR007	GLAND ROPE 20MM (KGS)	35	Kgs	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2950	GBFP001	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 80X250 mm	35	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2951	GBFP002	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 40X400 mm	35	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2952	GBFP003	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 50X400 mm	35	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2953	GBFP004	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 65X400 mm	35	Nos	\N	0.000	0.000	0.000	14.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2954	GBFP005	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 80X420 mm	35	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2955	GBFP006	SS 304 Q BELLOW HOSE PIPE (FLEXIBLE PIPE) 200X370 mm	35	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2956	GMSB0001	1/2"X2" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	500.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2957	GMSB0002	1/2"X4" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	45.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2958	GMSB0003	1/2"X3" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	320.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2959	GMSB0004	1/2"X6" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	200.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2960	GMSB0005	3/8"X2" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2961	GMSB0006	3/8"X2 1/2" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2962	GMSB0007	3/8"X3" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	300.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2963	GMSB0008	3/4"X2" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	250.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2964	GMSB0009	3/4"X5" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	200.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2965	GMSB0010	5/8"X2" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	150.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2966	GMSB0011	5/8"X3" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2967	GMSB0012	5/8"X4" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	170.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2968	GMSB0013	5/8"X5" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2969	GMSB0014	5/8"X6" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2970	GMSB0015	5/8"X7" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2971	GMSB0016	3/8"X4" MS BOLT & NUT, WASHER	35	Nos	7318-1500	0.000	0.000	0.000	250.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2972	GHTBN0001	10mmX75mm HTAC	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2973	GHTBN0002	12mmX40/50mm HTAC	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2974	GHTBN0003	14mmX50/65mm HTAC	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2975	GHTBN0004	16mmX25/40/75mm HTAC	35	Nos	7318-1500	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2976	GSSAB0001	12mmX2 1/2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	29.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2977	GSSAB0002	16mmX1 1/2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	24.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2978	GSSAB0003	16mm X 2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	19.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2979	GSSAB0004	16mm X 2 1/2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	43.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2980	GSSAB0005	3/8" X 2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	87.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2981	GSSAB0006	10mm X 2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	28.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2982	GSSAB0007	10mm X 2 1/2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2983	GSSAB0008	8mm X 2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	36.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2984	GSSAB0009	8mm X 2 1/2" SS ALLEN BOLT	35	Nos	7318	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2985	GSSCAS0001	12mm X 1" SS CSK ALLEN SCREW	35	Nos	7318	0.000	0.000	0.000	11.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2986	GSSCAS0002	10mm X 1/2" SS CSK ALLEN SCREW	35	Nos	7318	0.000	0.000	0.000	72.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2987	GSSCAS0003	12mm X 3/4" SS CSK ALLEN SCREW	35	Nos	7318	0.000	0.000	0.000	63.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2988	GSSCAS0004	3/8" X 2 1/2" SS CSK ALLEN SCREW	35	Nos	7318	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2989	GSSCS0001	5/16" X 2 1/2" SS CSK SCREW	35	Nos	7317-1400	0.000	0.000	0.000	75.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2990	GSSCS0002	5/16" X 1 1/4" SS CSK SCREW	35	Nos	7317-1400	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2991	GSSCS0003	6MM X 25MM SS CSK SCREW	35	Nos	7317-1400	0.000	0.000	0.000	200.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2992	GSSCS0004	8MM X 50MM SS CSK SCREW	35	Nos	7317-1400	0.000	0.000	0.000	18.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2993	GSSBN0001	8mm X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	43.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2994	GSSBN0002	1/4" X 3" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	64.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2995	GSSBN0003	3/8" X 3" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	56.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2996	GSSBN0004	10mm X 3" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	97.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2997	GSSBN0005	14mm X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2998	GSSBN0006	12mm X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	60.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
2999	GSSBN0007	1/2" X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	68.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3000	GSSBN0008	16mm  X 1 1/2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3001	GSSBN0009	1/2" X 4" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	100.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3002	GSSBN0010	5/8" X 5" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3003	GSSBN0011	3/4" X 4" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3004	GSSBN0012	1" X 1/2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3005	GSSBN0013	1" X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3006	GSSBN0014	3/8" X 4" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	48.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3007	GSSBN0015	5/8" X 4" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3008	GSSBN0016	16MM X 3" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3009	GSSBN0017	1" X 4" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3010	GSSBN0018	3/4" X 2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3011	GSSBN0019	3/4" X 3" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3012	GSSBN0020	3/8" X 2 1/2" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3013	GSSBN0021	3/8" X 1 1/4 SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3014	GSSBN0022	5/16" X 1 1/4 SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	32.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3015	GSSBN0023	1/4" X 1" SS BOLT & NUT	35	Nos	7318-1500	0.000	0.000	0.000	50.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3016	GSSSB001	12mmX2 1/2" STUD BOLT	35	Nos	7318-1500	0.000	0.000	0.000	17.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3017	GSSSB002	7/8" X 1 1/2" STUD BOLT	35	Nos	7318-1500	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3018	GSSSB003	3/4" X 7" STUD BOLT	35	Nos	7318-1500	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3019	GSSSB004	1" X 400mm STUD BOLT	35	Nos	7318-1500	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3020	GSSSB005	1 1/4" X 400mm STUD BOLT	35	Nos	7318-1500	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3021	GSSFT001	1 1/2" X 400mm FULL THRED BOLT	35	Nos	7318-1900	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3022	GER0001	2" WIRE BRUSH	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3023	GER0002	1" WIRE BRUSH	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3024	GER0003	ANABOND RTV SILICON RED 80GR	35	Nos	2710	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3025	GER0004	ANABOND RTV SILICON RED 25GR	35	Nos	2710	0.000	0.000	0.000	16.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3026	GER0005	GREAS GUN PESTOL TYPE	35	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3027	GER0006	HOSE CLAMPS 1"	35	Nos	\N	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3028	GER0007	HOSE CLAMPS 3/4"	35	Nos	\N	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3029	GER0008	FEVIQUICK PKTS	35	Nos	\N	0.000	0.000	0.000	82.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3030	GER0009	HOLE SAW DRILL BIT (1902) 6PC SET	35	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3031	GER0010	1" SHAVER BRUSH	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3032	GER0011	2" SHAVER BRUSH	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3033	GER0012	5 Mtr MEASURING TAPE	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3034	GER0013	RUST RELEASE SPRAY (480ML)	35	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3035	GER0014	1/2" PVC TAP'S	35	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3036	GER0015	1/2" TEFLON TAPE	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3037	GER0016	1" TEFLON TAPE	35	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3038	MSSC0001	S.S 1/2" COLLER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3039	MSSC0002	S.S 1" COLLER	31	Nos	\N	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3040	MSSC0003	S.S 1.5" COLLER	31	Nos	\N	0.000	0.000	0.000	17.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3041	MSSC0004	S.S 2" COLLER	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3042	MSSC0005	S.S 2.5 " COLLER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3043	MSSC0006	S.S 3 " COLLER	31	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3044	MSSC0007	S.S 4 " COLLER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3045	MSSC0008	S.S 5" COLLER	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3046	MSSC0009	S.S 6" COLLER	31	Nos	\N	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3047	MSSC0010	S.S 8 " COLLER	31	Nos	\N	0.000	0.000	0.000	18.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3048	MSSC0011	S.S 10" COLLER	31	Nos	\N	0.000	0.000	0.000	13.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3049	MSSC0012	S.S 12" COLLER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3050	MSSC0013	S.S 14 " COLLER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3051	MSSC0014	S.S 16" COLLER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3052	MSSR0001	S.S 2" X 1" REDUCER	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3053	MSSR0002	S.S 1.5" X 2 " REDUCER	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3054	MSSR0003	S.S 2 1/2 " X 3" REDUCER	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3055	MSSR0004	S.S 2" X 4" REDUCER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3056	MSSR0005	S.S 2 1/2" X 4 REDUCER	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3057	MSSR0006	S.S 3 " X 4 " REDUCER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3058	MSSR0007	S.S 5" X 6" REDUCER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3059	MSSR0008	S.S 6 X 4 REDUCER	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3060	MSSR0009	S.S 10" X 4" REDUCER	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3061	MSSR0010	S.S 12" X 3" REDUCER	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3062	MSSR0011	S.S 14" X 4" REDUCER	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3063	MSSBE001	S.S BEND 1/2"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3064	MSSBE002	S.S 1" BEND	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3065	MSSBE003	S.S 1.25" BEND	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3066	MSSBE004	S.S 1 1/2 " BEND	31	Nos	\N	0.000	0.000	0.000	32.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3067	MSSBE005	S.S 2" BEND	31	Nos	\N	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3068	MSSBE006	S.S 2.5" BEND	31	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3069	MSSBE007	S.S 3" BEND	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3070	MSSBE008	S.S 4" BEND	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3071	MSSBE009	S.S 5" BEND	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3072	MSSBE010	S.S 6" BEND	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3073	MSSBE011	S.S 8" BEND	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3074	MSSBE012	S.S 10" BEND	31	Nos	\N	0.000	0.000	0.000	19.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3075	MSSBE013	S.S 14" BEND	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3076	MMSF0001	M.S FLANGE 1/2"	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3077	MMSF0002	M.S FLANGE 1 "	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3078	MMSF0003	M.S FLANGE 1 1/2 " or 1.5 "	31	Nos	\N	0.000	0.000	0.000	27.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3079	MMSF0004	M.S FLANGE 2"	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3080	MMSF0005	M.S FLANGE 2.5"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3081	MMSF0006	M.S FLANGE 3 "	31	Nos	\N	0.000	0.000	0.000	16.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3082	MMSF0007	M.S FLANGE 4"	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3083	MMSF0008	M.S FLANGE 5"	31	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3084	MMSF0009	M.S FLANGE 6"	31	Nos	\N	0.000	0.000	0.000	20.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3085	MMSF0010	M.S FLANGE 8"	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3086	MMSF0011	M.S FLANGE 10"	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3087	MMSF0012	M.S FLANGE 12"	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3088	MMSF0013	M.S FLANGE 14"	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3089	MMSF0014	M.S FLANGE 16"	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3090	MSTF0001	STEAMLINE 3" FLANGES	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3091	MSTF0002	STEAMLINE 3" FLANGES	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3092	MSPN001	1/4" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3093	MSPN002	1/2" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	28.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3094	MSPN003	3/8" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3095	MSPN004	1" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	31.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3096	MSPN005	1.5" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3097	MSPN006	2" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	10.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3098	MSPN007	2.5" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3099	MSPN008	3" S.S NIPPLE	31	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3100	MSSS001	1/4" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3101	MSSS002	1" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3102	MSSS003	1/2" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	46.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3103	MSSS004	1 1/2" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3104	MSSS005	3/4" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	65.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3105	MSSS006	3/8" S.S SOCKET	31	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3106	MSSHX001	1" SS HEX NIPPLE	31	Nos	\N	0.000	0.000	0.000	47.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3107	MSSHX002	1/4" SS HEX NIPPLE	31	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3108	MSSHX003	1/2" SS HEX NIPPLE	31	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3109	MSSHX004	1 1/2" SS HEX NIPPLE	31	Nos	\N	0.000	0.000	0.000	27.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3110	MSSHX005	3/4" SS HEX NIPPLE	31	Nos	\N	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3111	CHSTP001	STARCH	28	Kgs	3824	0.000	0.000	0.000	31300.000	32.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3112	CHPAS003	POLY ALUMINIUM CHLORIDE ( SOLID)	28	Kgs	28273200	0.000	0.000	0.000	2583.000	31.50	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3113	CHSFS002	SURFACE SIZE (700C)	28	Kgs	4811	0.000	0.000	0.000	4997.000	98.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3114	CHENL004	ENZYME (L)	28	Kgs	35079062	0.000	0.000	0.000	19.000	625.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3115	CHSRA005	RETENTION AID (2024)	28	Kgs	39069090	0.000	0.000	0.000	880.000	350.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3116	CHDEL007	DEFOAMER (SE 100)	28	Kgs	34029099	0.000	0.000	0.000	941.000	215.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3117	CHCOA004	COAGULANT (CL 200)	28	Kgs	3824	0.000	0.000	0.000	3215.000	151.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3118	CHSKR006	KROFTA (303)	28	Kgs	39069090	0.000	0.000	0.000	909.000	255.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3119	CHBSU012	BELT PRESS (SUCHEM - 638 )	28	Kgs	3906	0.000	0.000	0.000	19.000	290.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3120	CHGYD008	GOLDEN YELLOW DYE	28	Kgs	48043900	0.000	0.000	0.000	2500.000	180.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3121	CHSBC013	SE-BOND 102(CRACKING AGENT)	28	Kgs	3809 92 00	0.000	0.000	0.000	0.000	170.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3122	CHPML010	PROMASK 192	28	Kgs	38249022	0.000	0.000	0.000	203.000	320.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3123	CHPSL011	PROSOLVE 126	28	Kgs	38249022	0.000	0.000	0.000	212.000	230.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3124	CHPDL009	PROSOLVE ADVANCE	28	Kgs	38249022	0.000	0.000	0.000	2718.000	230.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3125	CHBPS014	BLEACHING POWDER (S)	28	Kgs	28281010	0.000	0.000	0.000	62.000	38.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3126	CHHYP015	SODIUM HYPO CHLORIDE [HYPO] (L)	28	Kgs	28289019	0.000	0.000	0.000	130.000	18.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3127	CHHCA016	HCL [PULP MILL]	28	Kgs	28061000	0.000	0.000	0.000	380.000	10.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3129	CHPHB017	PH BOOSTER [3230] (L)	28	Kgs	38249900	0.000	0.000	0.000	85.000	87.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3130	CHASL018	ANTI SCALEN [3220] (L)	28	Kgs	38249900	0.000	0.000	0.000	25.000	92.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3131	CHOXL019	OXYGEN SCAVANGER [3210] (L)	28	Kgs	38249022	0.000	0.000	0.000	76.000	85.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3132	CHROL020	RO ANTI SCALEN [3291 (L)	28	Kgs	38249022	0.000	0.000	0.000	33.000	240.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3133	CHCSF021	CAUSTIC SODA FLAKES	28	Kgs	28151110	0.000	0.000	0.000	480.000	45.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3134	CHDEL022	DESCALING [3250] (L)	28	Kgs	3824	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:48:09.915991	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3162	ECT0001	3TF30-10-0AP0-(230V/50HZ,276/60) (9A-415V) SIEMENS AIR BREAK POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3163	ECT0002	3TF32-00-0AP0-(230V/50HZ,276/60) (16A-415V) SIEMENS AIR BREAK POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3164	ECT0003	3TF35-00-0AP0-(230V/50HZ) (38 A-415V) SIEMENS AIR BREAK POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3165	ECT0004	LC1E2510B5 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3166	ECT0005	LC1E2510B7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3167	ECT0006	LC1E 3810M5/B5 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3168	ECT0007	LC1E3810M7 /B7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3169	ECT0008	LC1E40M7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3170	ECT0009	LC1D12M7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	7.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3171	ECT0010	LC1D18M7SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3172	ECT0011	LC1D25M7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3173	ECT0012	LC1D32M7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3174	ECT0013	LC1D40AM7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3175	ECT0014	LC1D65AM7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3176	ECT0015	LC1D80AM7 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3177	ECT0016	MNX12 240 Vac POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3178	ECT0017	MNX18 240 Vac POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3179	ECT0018	MNX25 -240 Vac POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3180	ECT0019	MNX 32-110V POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3181	ECT0020	MNX 32-240V POWER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3182	ECT0021	MNX 40-110V (L&T)(SWITCHGEAR) CONTACTOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3183	ECT0022	MNX40-240V (L&T)(SWITCHGEAR) CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3184	ECT0023	ABB  25AMPS -230V/50 HZ CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3185	ECT0024	ABB -45 AMPS 230V /50 HZ/ 240V /60HZ CONTACTOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3186	ECT0025	LC1DPKM7 -30 KVAR CONTACTORS -CAPACITOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3187	ECT0026	LC1DMKM7 -25 KVAR CONTACTORS -CAPACITOR	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3188	ECT0027	LC1DLKM7-20 KVAR CONTACTORS -CAPACITOR	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3189	ECT0028	LC1DWKM7C -62 KVAR CONTACTORS -CAPACITOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3190	ECT0029	LC1`DWK12M7 -SWITCHING CONTACTORS -CAPACITOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3191	ECT0030	3 kVAr X 440 V  POWER CAPACITOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3192	ECT0031	20 KVR CAPACITOR (L&T) 440V -RACK	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3193	ECT0032	LC1D1157 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3194	ECT0033	LC1D1400 SCHNEIDER CONTACTOR	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3195	ECT0034	LA5D150830 SCHNEIDER CONTACTOR KIT (LC1D150)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3196	ECT0035	LA5FF431 SCHNEIDER CONTACTOR KIT (LC1F150,LC1F115)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3197	ECT0036	LAF400803 SCHNEIDER CONTACTOR KIT (LC1F400)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3198	ERE0001	SCHNEIDER RELAY LRD 07 (1.6 AMPS -2.5 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3199	ERE0002	SCHNEIDER RELAY LRD 10 (4 AMPS -6 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3200	ERE0003	SCHNEIDER RELAY LRD 16 (9 AMPS -13AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3201	ERE0004	SCHNEIDER RELAY LRD 21 (12 AMPS -18AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3202	ERE0005	SCHNEIDER RELAY LRD 22 (16AMPS -24 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3203	ERE0006	SCHNEIDER RELAY LRD 32 (23AMPS-32 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3204	ERE0007	SCHNEIDER RELAY LRD 35 (30AMPS-38 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3205	ERE0008	SCHNEIDER RELAY LRE35 (30AMPS-38 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3206	ERE0009	SCHNEIDER RELAY LRE353 (23AMPS-32 AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3207	ERE0010	L & T (SWITCHGEAR) MN2 THERMAL OVERLOAD RELAY (2- 3.3 AMPS)	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3208	ERE0011	L & T (SWITCHGEAR) MN2 THERMAL OVERLOAD RELAY (3- 5 AMPS)	30	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3209	ERE0012	L & T (SWITCHGEAR) MN2 THERMAL OVERLOAD RELAY (9- 15 AMPS)	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3210	ERE0013	ABB THERMAL OVERLOAD RELAY (10 -14 AMPS)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3211	ERE0014	MK1 STARTER THERMAL OVERLOAD RELAY (1.5 -2.5 AMPS)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3212	ERE0015	MK1 STARTER THERMAL OVERLOAD RELAY (4- 6.5 AMPS)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3333	STA004	REGISTRES NO 6	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3213	ERE0016	MK1 STARTER THERMAL OVERLOAD RELAY (6-10 AMPS)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3214	ERE0017	MK1 STARTER THERMAL OVERLOAD RELAY (9-14 AMPS)	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3215	ERE0018	LR 9F 5369 ELECTROIC OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3216	ERE0019	LR 9F7375 ELECTROIC OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3217	ERE0020	L & T (SWITCHGEAR) MN2 THERMAL OVERLOAD RELAY (4.5- 7.5AMPS)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3218	ERE0021	SIEMENS REAL (20AMPS-25AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3219	ERE0022	SIEMENS REAL (2.8AMPS-4AMPS) THERMAL OVERLOAD RELAY	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3220	ERE0023	L & T (SWITCHGEAR) 353 THERMAL OVERLOAD RELAY (23AMPS-32AMPS)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3221	ERE0024	L & T (SWITCHGEAR) 3355 THERMAL OVERLOAD RELAY (30AMPS-40AMPS)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3222	ERE0025	MINILEC  BP-VOLTAGE SENSING PHASE FAILURE RELAY 380-440V AC(S1 VMR7)	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3223	EMC0001	EATON 80 AMPS FUSE (690 V-200KA )-SIZE -1	30	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3224	EMC0002	L&t 160 AMPS SIZE 00	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3225	EMC0003	C& S 200 AMPS FUSE (500V-80KA) SIZE -1	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3226	EMC0004	200 AMPS HRC FUSE (SIZE-0)	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3227	EMC0005	L& T SWITCHGEAR 400 AMPS (415 V -100 KA) SIZE -2	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3228	EMC0006	MCB 6AMPS-1 P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3229	EMC0007	MCB 6AMPS -2 P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3230	EMC0008	MCB 6AMPS -3 P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3231	EMC0009	MCB 10AMPS-1 P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3232	EMC0010	MCB 10AMPS-3 P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3233	EMC0011	MCB 16 AMPS -1P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3234	EMC0012	MCB 16 AMPS -3P	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3235	EMC0013	MCB 25 AMPS -3P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3236	EMC0014	MCB 32AMPS-3P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3237	EMC0015	MCB 32AMPS-4P	30	Nos	\N	0.000	0.000	0.000	9.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3238	EMC0016	MCB 40 AMPS -3P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3239	EMC0017	MCB 63AMPS -3P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3240	EMC0018	MCB 63 AMPS -4 P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3241	EMC0019	LV510307 MCCB 100 A -3P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3242	EMC0020	LV516303 MCCB 160 A 3P	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3243	EMC0021	LV525303 MCCB 250A 3P /SWITCH GEAR 25 KA	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3244	EMC0022	LV563307 300A -3P MCCB	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3245	EMC0023	MCB 32 AMPS 2P	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3246	EMC0024	MCB 25 AMPS 2P	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3247	ELEG0001	MOTOR STATR 9-14 AMP AMPER	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3248	ELEG0002	SIEMENS 3TY7 460-OYA CONTACTOR KIT	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3249	ELEG0003	REWIDER POTENTIO METER 10K	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3250	ELEG0004	PRESOR SWITCH 10A	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3251	ELEG0005	SMPS 24 V 10A	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3252	ELEG0006	MK1 STATOR COIL	30	Nos	\N	0.000	0.000	0.000	5.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3253	ELEG0007	L&T MK1 STATOR RELAY KIT	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3254	ELEG0008	SIEMENS NET CONETER	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3255	ELEG0009	ADD ON BLOK	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3256	ELEG0010	L&T ADD ON BLOK 2NO2NC	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3257	ELEG0011	SIEMENS ADD ON BLOK 2NO2NC	30	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3258	ELEG0012	L&T COMPRSER TERMINAL	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3259	ELEG0013	PID CONTROLLER TN: 00442008 (JUMO MAKE)	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3260	ELEG0014	SWITCH GEAR MAKE CONTROLLER 3 PH ,380V,CAT: ST921660000	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3261	ELEG0015	SIREN 150-MFTER1, 90-120CB	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3262	ELEG0016	REPON/SIBASS FAN- 24 V	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3263	ELEG0017	100 WATS FLOOD LIGHT	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3264	ELEG0018	LED TUBE LIGHTS	30	Nos	\N	0.000	0.000	0.000	15.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3265	ELEG0019	LX1FJ220 COIL SCHNEIDER	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3266	ELEG0020	12SDTO STATER DELTA TIMER 3S-120S	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3267	ELEG0021	120DTY STATER DELTA TIMER 3S-30S	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3268	ELEG0022	SIEMENS ELECTORNIC TIMER (3RP15131AP308K) 3-60S	30	Nos	\N	0.000	0.000	0.000	6.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3269	ELEG0023	SIEMENS ELECTORNIC TIMER (3RP15131AP308K) 5S-100S	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3270	ELEG0024	TEMPERATURE CONTROLLER (513AX)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3271	ELEG0025	TEMPERATURE CONTROLLER (513)	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3272	ELEG0026	ROTAEY SWITCH (SAI2FR) (61192SCB03TDYR)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3273	ELEG0027	LIMIT SWITCH (240V/30V) JAI BALAJI	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3274	ELEG0028	ONDELAY TIMER 0.6S-60M PLY 2C/O CSA	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3275	ELEG0029	ONDELAY TIMER 0.6S-60M PLY 2C/O CSA	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3276	ELEG0030	STAR DELTA TIMER 3S-120S (2ASDT0) (24-240VAC/DC)	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3277	ELEG0031	TERMINAL PLATE CROMPTON (100 HP) (T17037)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3278	ELEG0032	TERMINAL PLATE CROMPTON (320 HP) (W60XL385XT30)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3279	ELEG0033	TERMINAL PLATE ABB 200HP (T17128) TAMCO	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3280	ELEG0034	TERMINAL PLATE CROMPTON T1 7138	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3281	ELEG0035	TERMINAL PLATE RX6 STUD 7009	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3282	ELEG0036	DISTRIBUSTION BOX	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3283	ELEG0037	RPM METER MULTISPAN PI-38-A2-00 (AC) 999 TO 9999)	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3284	ELEG0038	TECHNO METER CONTER (C-96X)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3285	ELEG0039	PROCERSS INDICATOR PIC101A-VI230	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3286	ELEG0040	PROCERSS INDICATOR PIC101A-VI230	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3287	ELEG0041	SCHENIDER LADSN20 CONTACT BLOCKS	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3288	ELEG0042	SCHENIDER LADT2 TIMER DELAY BLOCKS	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3289	ELEG0043	L&T COIL-MK1 CAT NO: AA9000470000	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3290	ELEG0044	SCHENIDER LA7D3064 TERMINAL BLOCK	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3291	ELEG0045	TERMINAL PLATE TAMCO T1-7040	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3292	ELEG0046	TERMINAL PLATE TAMCO T1-7135	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3293	ELEG0047	MOTOR FANS CR.AD-112 (HOLE24.5XOD190) KEY WAY TYPE	30	Nos	\N	0.000	0.000	0.000	8.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3294	ELEG0048	MOTOR FANS  CR (HOLE 24 X OD155) PIN TYPE	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3295	ELEG0049	MOTOR FANS ND-200  CR (HOLE56  X OD260) KEY WAY TYPE #1728	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3296	ELEG0050	MOTOR FANS   CR (HOLE48  X OD290) SCREW TYPE	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3297	ELEG0051	MOTOR FANS   CR (HOLE48  X OD290) PIN TYPE	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3298	ELEG0052	MOTOR FANS   CR (HOLE 93  X OD 400) KEY WAY TYPE	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3299	ELEG0053	TERMINAL BLOCK-PLATE Fr.ND200 CG (40HP)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3300	ELEG0054	TERMINAL BLOCK-PLATE Fr.ND160-180 CG (20-30HP)	30	Nos	\N	0.000	0.000	0.000	3.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3301	ELEG0055	TERMINAL BOX 112 /132 CG (40-20hp)	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3302	ELEG0056	COLING FAN ND132 CG, (7.5HP)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3303	ELEG0057	COLING FAN ND160 CG, 4P (20HP)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3304	ELEG0058	COLING FAN F-80 (HOLE19XOD137)	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3305	ELEG0059	6 WAY PVC MCB BOX	30	Nos	\N	0.000	0.000	0.000	1.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3306	ELEG0060	15" DULAUST FAG ALMOUCRD	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3307	ELEG0061	COPPER FLAT LUGS 10 SQMM	30	Nos	\N	0.000	0.000	0.000	70.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3308	ELEG0062	COPPER FLAT LUGS 16 SQMM	30	Nos	\N	0.000	0.000	0.000	14.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3309	ELEG0063	COPPER FLAT LUGS 25 SQMM	30	Nos	\N	0.000	0.000	0.000	36.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3310	ELEG0064	COPPER FLAT LUGS 35 SQMM	30	Nos	\N	0.000	0.000	0.000	39.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3311	ELEG0065	COPPER FLAT LUGS 50 SQMM	30	Nos	\N	0.000	0.000	0.000	25.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3312	ELEG0066	COPPER FLAT LUGS 70 SQMM	30	Nos	\N	0.000	0.000	0.000	43.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3313	ELEG0067	COPPER FLAT LUGS 95 SQMM	30	Nos	\N	0.000	0.000	0.000	39.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3314	ELEG0068	COPPER FEMALE LUGS  95 SQMM	30	Nos	\N	0.000	0.000	0.000	19.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3315	ELEG0069	COPPER FEMALE LUGS  120 SQMM	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3316	ELEG0070	COPPER FLAT LUGS 120 SQMM	30	Nos	\N	0.000	0.000	0.000	35.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3317	ELEG0071	COPPER FLAT LUGS 150 SQMM	30	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3318	ELEG0072	ALUMINIUM FLAT LUGS  10 SQMM	30	Nos	\N	0.000	0.000	0.000	40.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3319	ELEG0073	ALUMINIUM FLAT LUGS  15 SQMM	30	Nos	\N	0.000	0.000	0.000	16.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3320	ELEG0074	ALUMINIUM FLAT LUGS  16 SQMM	30	Nos	\N	0.000	0.000	0.000	21.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3321	ELEG0075	ALUMINIUM FLAT LUGS  25 SQMM	30	Nos	\N	0.000	0.000	0.000	24.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3322	ELEG0076	ALUMINIUM FLAT LUGS  35 SQMM	30	Nos	\N	0.000	0.000	0.000	31.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3323	ELEG0077	ALUMINIUM FEMALE LUGS  150 SQMM	30	Nos	\N	0.000	0.000	0.000	30.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3324	ELEG0078	ALUMINIUM FLAT LUGS  185 SQMM	30	Nos	\N	0.000	0.000	0.000	12.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3325	ELEG0079	ALUMINIUM FLAT LUGS  240 SQMM	30	Nos	\N	0.000	0.000	0.000	23.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3326	ELEG0080	ALUMINIUM FLAT LUGS  300 SQMM	30	Nos	\N	0.000	0.000	0.000	4.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3327	ELEG0081	INSULATIN TAPE BLUE, GREEN, RED, YELLOW & BLACK	30	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3328	ELEG0082	TERMINAL PLATE ABB 200HP (T1-7040) TAMCO	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3329	ELEG0083	TERMINAL PLATE ABB 200HP (T1-7135) TAMCO	30	Nos	\N	0.000	0.000	0.000	2.000	0.00	t	2026-08-09 11:49:29.211122	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3330	STA001	REGISTRES 100 PAGE	33	Nos	\N	0.000	0.000	0.000	18.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3331	STA002	REGISTRES 200 PAGE	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3332	STA003	REGISTRES NO 6	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3334	STA005	BIG BOX FILES	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3335	STA006	SMALL BOX FILE	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3336	STA007	SPRING FILES	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3337	STA008	L FOLDERS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3338	STA009	A4 COVER FOLDERS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3339	STA010	BLUE PENS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3340	STA011	BLACK PENS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3341	STA012	RED PENS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3342	STA013	BLUE MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3343	STA014	BLACK MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3344	STA015	RED MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3345	STA016	BLUE PEN MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3346	STA017	BLACK PEN MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3347	STA018	RED PEN MARKER	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3348	STA019	GEM CLIPS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3349	STA020	BALL NIDELS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3350	STA021	STAPELER NO10	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3351	STA022	STAPELER PINS BOX	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3352	STA023	HOLE PUNCHING MEHINE BIG	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3353	STA024	HOLE PUNCHING MEHINE SMALL	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3354	STA025	AA BATTERY	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3355	STA026	AAA BATTERY	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3356	STA027	9 VOLT BATTERY	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3357	STA028	BINDER CKIPS 41 MM	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3358	STA029	BINDER CKIPS 51 MM	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3359	STA030	CALCULATER CASIO	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3360	STA031	A4 PAPER BUNDELS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
3361	STA032	A4 CLOTH COVERS	33	Nos	\N	0.000	0.000	0.000	0.000	0.00	t	2026-08-09 11:53:06.935459	f	365	\N	\N	\N	\N	\N	\N	0.00	\N	\N
\.


--
-- Data for Name: motor_electrical_specs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.motor_electrical_specs (id, sr_no, motor_name, kw, hp, rpm, full_amp, bearing_no_fs, bearing_no_bs, section_label, created_at) FROM stdin;
1	1	PULPER MOTOR -ABB	250.00	340.00	988	460.00	NU-322-C3	6316-C3	Pulp Mill	2026-07-10 21:13:57.214109
2	2	SCANNER MOTOR- CE	45.00	60.00	1475	81.00	6313-C3	6313-C3	Pulp Mill	2026-07-10 21:13:57.214109
3	3	SANDTRAP PUMP NO 2	18.50	25.00	1460	32.00	6310-C3	6210-C3	Pulp Mill	2026-07-10 21:13:57.214109
4	4	SANDTRAP PUMP NO 1	55.00	75.00	1485	101.00	6315-C3	6315-C3	Pulp Mill	2026-07-10 21:13:57.214109
5	5	DRUM CHEST PUMP	60.00	80.00	1475	104.00	6314-C3	6314-C3	Pulp Mill	2026-07-10 21:13:57.214109
6	6	DRUM CHEST AGITATOR	22.00	30.00	975	40.00	6312-C3	6212-C3	Pulp Mill	2026-07-10 21:13:57.214109
7	7	NO.1 CHEST PUMP	55.00	75.00	1475	92.00	6314-C3	6314-C3	Pulp Mill	2026-07-10 21:13:57.214109
8	8	NO.1 CHEST AGITATOR	22.00	30.00	975	40.00	6312-C3	6212-C3	Pulp Mill	2026-07-10 21:13:57.214109
9	9	NO.2 CHEST PUMP 1	30.00	40.00	1460	53.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-07-10 21:13:57.214109
10	10	NO.2 CHEST PUMP 2	22.00	30.00	1460	40.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-07-10 21:13:57.214109
11	11	NO.3 CHEST PUMP	30.00	40.00	1475	53.00	6312-2Z-CE	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
12	12	NO.3 CHEST AGITATOR	22.00	30.00	975	40.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-07-10 21:13:57.214109
13	13	NO.4 CHEST PUMP	15.00	20.00	1460	27.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-07-10 21:13:57.214109
14	14	NO.4 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
15	15	NO.5 CHEST PUMP	15.00	20.00	1460	27.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-07-10 21:13:57.214109
16	16	NO.5 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
17	17	NO.6 CHEST PUMP	22.00	30.00	1460	40.00	6310-2Z-C3	6210-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
18	18	NO.6 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
19	19	NO.7 CHEST PUMP	30.00	40.00	1475	53.00	6312-2Z-CE	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
20	20	NO.7 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
21	21	NO.8 CHEST PUMP	30.00	40.00	1470	54.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
22	22	NO.8 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
23	23	NO.9 CHEST PUMP-FRESH WATER	3.70	5.00	2800	8.20	\N	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
24	24	NO.9 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
25	25	TDR- REFINER NO.1- 24"	315.00	425.00	744	588.00	6322--C3	6322--C3	Pulp Mill	2026-07-10 21:13:57.214109
26	26	TDR- REFINER NO.2- 21"	250.00	335.00	990	434.00	6322--C3	6322--C3	Pulp Mill	2026-07-10 21:13:57.214109
27	27	THICKNER	15.00	20.00	975	27.00	6310-2Z-C3	6210-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
28	28	TURBO NO.1 -900	90.00	120.00	1480	147.00	6318-C3	6318-C3	Pulp Mill	2026-07-10 21:13:57.214109
29	29	TURBO NO.2-450	37.00	50.00	1475	63.00	6313-C3	6213-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
30	30	AFT-PRESSURE SCREEN-1	45.00	60.00	1475	81.00	6313-C3	6313-C3	Pulp Mill	2026-07-10 21:13:57.214109
31	31	AFT-PRESSURE SCREEN-2	37.00	50.00	980	66.00	6314-C3	6314-C3	Pulp Mill	2026-07-10 21:13:57.214109
32	32	AFT-PRESSURE SCREEN-3	37.00	50.00	1475	63.00	6313-C3	6213-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
33	33	AFT-PRESSURE SCREEN-4	30.00	40.00	1465	53.00	6312-C3-2Z	6212-2Z-C3	Pulp Mill	2026-07-10 21:13:57.214109
34	34	CONVEYOR BELT MOTOR	5.00	7.50	1455	85.00	\N	\N	Pulp Mill	2026-07-10 21:13:57.214109
35	35	PULP MILL CRANE SIDE -1	0.75	1.00	1410	1.60	6004-2Z	6004-2Z	Pulp Mill	2026-07-10 21:13:57.214109
36	36	PULP MILL CRANE SIDE -2	0.75	1.00	1410	1.60	6004-2Z	6004-2Z	Pulp Mill	2026-07-10 21:13:57.214109
37	37	PULP MILL CRANE -L/R	0.35	0.50	1410	\N	\N	\N	Pulp Mill	2026-07-10 21:13:57.214109
38	38	PULP MILL CRANE -U/D	2.20	3.00	1410	4.50	\N	\N	Pulp Mill	2026-07-10 21:13:57.214109
39	39	AFT PRESSURE SCREEN BLOWER	0.37	0.50	1410	1.70	\N	\N	Pulp Mill	2026-07-10 21:13:57.214109
40	40	BACK WATER PUMP SIDE	3.30	5.00	1450	7.50	\N	\N	Pulp Mill	2026-07-10 21:13:57.214109
41	1	BOTTOM BLOWER HEADBOX	3.70	5.00	1440	7.10	6306-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
42	2	CHEMICAL AGITATOR	3.70	5.00	1425	7.50	6206-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
43	3	DOGING PUMP NO.1	0.37	0.50	1400	1.09	6003-2Z	6003-2Z	Machine	2026-07-10 21:13:57.214109
44	4	DOGING PUMP NO.2	0.37	0.50	1400	1.09	6003-2Z	6003-2Z	Machine	2026-07-10 21:13:57.214109
45	5	CENTI CLAEANER TOP	30.00	40.00	1465	53.00	6312-2Z	6212-2Z	Machine	2026-07-10 21:13:57.214109
46	6	CENTI CLEANER MOTOR NO.1 BOTTOM	30.00	40.00	1465	53.00	6312-2Z	6212-2Z	Machine	2026-07-10 21:13:57.214109
47	7	CENTI CLEANER MOTOR NO.2 BOTTOM	11.00	15.00	1460	21.00	6306-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
48	8	TOP PRESSURE SCREEN	45.00	60.00	1480	76.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
49	9	BOTTOM FAN PUMP	132.00	180.00	1490	214.00	6319-C3	6319-C3	Machine	2026-07-10 21:13:57.214109
50	10	TOP FAN PUMP	75.00	100.00	1480	123.00	6318-C3	6319-C3	Machine	2026-07-10 21:13:57.214109
51	11	VACCUM PUMP NO.1	160.00	220.00	988	275.00	6322-C3	6322-C3	Machine	2026-07-10 21:13:57.214109
52	12	VACCUM PUMP NO.2	110.00	150.00	1485	175.00	6319-C3	6319-C3	Machine	2026-07-10 21:13:57.214109
53	13	VACCUM PUMP NO.3	160.00	220.00	989	280.00	6319-C3	6319-C3	Machine	2026-07-10 21:13:57.214109
54	14	NO.1 VACCUM SEPRATOR	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Machine	2026-07-10 21:13:57.214109
55	15	NO.2 VACCUM SEPRATOR	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Machine	2026-07-10 21:13:57.214109
56	16	COUCH ROLL MOTOR	220.00	300.00	1486	350.00	6322-C3	6322-C3	Machine	2026-07-10 21:13:57.214109
57	17	BOTTOM PRESSURE SCREEN	45.00	60.00	1480	76.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
58	18	NO.1 PRESS MOTOR -TOP	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-07-10 21:13:57.214109
59	19	NO.2 PRESS MOTOR -TOP	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-07-10 21:13:57.214109
60	20	NO.2 PRESS MOTOR -BOTTOM	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-07-10 21:13:57.214109
61	21	FIRST DRYER MOTOR	75.00	100.00	1480	126.00	6318-C3	6318-C3	Machine	2026-07-10 21:13:57.214109
62	22	SECOND DRYER MOTOR	75.00	100.00	1480	126.00	6318-C3	6318-C3	Machine	2026-07-10 21:13:57.214109
63	23	CONDENSER PUMP NO.1	3.70	5.00	2800	7.80	\N	\N	Machine	2026-07-10 21:13:57.214109
64	24	CONDENSER PUMP NO.2	1.10	2.00	2800	3.40	\N	\N	Machine	2026-07-10 21:13:57.214109
65	25	POPE REEL MOTOR	45.00	60.00	1475	76.00	6314-2Z	6314-2Z	Machine	2026-07-10 21:13:57.214109
66	26	POPE REEL ARM MOTOR	1.10	2.00	1440	7.20	6206-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
67	27	CALENDAR ROLL MOTOR	55.00	75.00	1475	92.00	6314-2Z	6314-2Z	Machine	2026-07-10 21:13:57.214109
68	28	NO.3 DRYER GEAR MOTOR 1	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-07-10 21:13:57.214109
69	29	NO.3 DRYER GEAR MOTOR 2	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-07-10 21:13:57.214109
70	30	NO.3 DRYER GEAR MOTOR 3	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-07-10 21:13:57.214109
71	31	NO.3 DRYER GEAR MOTOR 4	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-07-10 21:13:57.214109
72	32	HYDRAULIC PUMP NO.1- POPE REEL	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
73	33	HYDRAULIC PUMP NO.2 POPE REEL	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
74	34	HYDRAULIC PUMP NO.3 PRESS	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
75	35	HYDRAULIC PUMP NO.4 PRESS	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
76	36	BACK WATER REMOVAL PUMP -OFF	11.00	15.00	2925	19.00	6309-2Z	6209-2Z	Machine	2026-07-10 21:13:57.214109
77	37	SIZE PRESS ROLL TOP MOTOR	37.00	50.00	1480	63.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
78	38	SIZE PRESS ROLL BOTTOM MOTOR	37.00	50.00	1480	63.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
79	39	KUT -PIT MOTOR	22.00	30.00	1475	43.00	6312-2Z	6212-2Z	Machine	2026-07-10 21:13:57.214109
80	40	TOP WIRE MOTOR	45.00	60.00	1475	73.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
81	41	BOTTOM WIRE MOTOR	45.00	60.00	1475	73.00	6313-2Z	6213-2Z	Machine	2026-07-10 21:13:57.214109
82	42	TOP HEAD BOX BLOWER MOTOR	3.70	5.00	1440	7.00	6306-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
83	43	TOP HEAD BOX HOLY ROLL-1 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
84	44	TOP HEAD BOX HOLY ROLL-2 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
85	45	BOTTOM HEAD BOX HOLY ROLL -1 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
86	46	BOTTOM HEAD BOX HOLY ROLL -2 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-07-10 21:13:57.214109
87	47	WIRE HIGH PRESSURE PUMP	3.70	5.00	1450	\N	\N	6205-2Z	Machine	2026-07-10 21:13:57.214109
88	48	WIRE SHOWER MOTOR	1.10	2.00	2900	8.00	\N	\N	Machine	2026-07-10 21:13:57.214109
89	49	COMPRESSOR MOTOR -1	30.00	40.00	2900	52.00	\N	\N	Machine	2026-07-10 21:13:57.214109
90	50	COMPRESSOR MOTOR-2	30.00	40.00	2900	52.00	\N	\N	Machine	2026-07-10 21:13:57.214109
91	51	MACHINE CRANE MOTOR UP/DOWN	10.00	15.00	915	21.00	slipring motor-Dc	\N	Machine	2026-07-10 21:13:57.214109
92	52	MACHINE CRANE MOTOR LEFT	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
93	53	MACHINE CRANE MOTOR RIGHT	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
94	54	MACHINE CRANE MOTOR EAST-WEST	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-07-10 21:13:57.214109
95	55	MACHINE CRANE BREAK DRUM MOTOR	0.75	1.00	880	1.90	\N	\N	Machine	2026-07-10 21:13:57.214109
96	56	LOADING CRANE LEFT	0.75	1.00	880	1.90	\N	\N	Machine	2026-07-10 21:13:57.214109
97	57	LOADING CRANE RIGHT	0.75	1.00	880	1.90	\N	\N	Machine	2026-07-10 21:13:57.214109
98	58	LOADING CRANE EAST-WEST	0.75	1.00	1440	2.00	\N	\N	Machine	2026-07-10 21:13:57.214109
99	59	LOADING CRANE UP/DOWN	7.50	10.00	1440	13.00	\N	\N	Machine	2026-07-10 21:13:57.214109
100	60	WATER REMOVAL PUMP- BOOTTOM FAN	2.20	3.00	2800	4.20	\N	\N	Machine	2026-07-10 21:13:57.214109
101	61	COUCH-PIT WATER REMOVALPUMP	2.20	3.00	2800	4.20	\N	\N	Machine	2026-07-10 21:13:57.214109
102	62	TOP PRESSURE SCREEN BLOWER	0.37	0.50	1410	1.70	\N	\N	Machine	2026-07-10 21:13:57.214109
103	1	AGITATOR TANK-1	2.20	3.00	1440	4.20	\N	\N	Starch	2026-07-10 21:13:57.214109
104	2	AGITATOR TANK-2	2.20	3.00	1440	4.20	\N	\N	Starch	2026-07-10 21:13:57.214109
105	3	AGITATOR TANK-3	2.20	3.00	1440	4.20	\N	\N	Starch	2026-07-10 21:13:57.214109
106	4	NO.1 PUMP (size press pump)	5.50	7.50	1450	10.50	6308-2Z	6208-2Z	Starch	2026-07-10 21:13:57.214109
107	5	NO.4 PUMP (SIZE PRESS PUMP)	2.20	3.00	1440	\N	MONO BLOCK	\N	Starch	2026-07-10 21:13:57.214109
108	6	NO.5 PUMP	2.20	3.00	2800	\N	\N	\N	Starch	2026-07-10 21:13:57.214109
109	7	NO.7 PUMP (EMERGENCY -ON)	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-07-10 21:13:57.214109
110	8	NO.8 PUMP	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-07-10 21:13:57.214109
111	9	NO.10 PUMP (EMERGENCY -ON)	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-07-10 21:13:57.214109
112	10	BACK(WASTE) WATER REMOVAL PUMP	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Starch	2026-07-10 21:13:57.214109
113	11	DRILL MCN MOTOR	1.50	2.00	1440	4.40	\N	\N	Starch	2026-07-10 21:13:57.214109
114	12	LIGHT MCN	2.20	3.00	1440	5.00	\N	\N	Starch	2026-07-10 21:13:57.214109
115	1	MAIN MOTOR -1	75.00	100.00	1480	123.00	6318-C3	6318-C3	Rewinder	2026-07-10 21:13:57.214109
116	2	MAIN MOTOR -2	75.00	100.00	1480	123.00	6318-C3	6318-C3	Rewinder	2026-07-10 21:13:57.214109
117	3	BLOWER MOTOR	15.00	20.00	2920	26.00	6310-2Z	6210-2Z	Rewinder	2026-07-10 21:13:57.214109
118	4	CORE PIPE MOTOR	2.30	3.00	1440	4.60	\N	\N	Rewinder	2026-07-10 21:13:57.214109
119	5	REWINDER CRANE UP/DOWN	2.20	3.00	960	4.20	\N	\N	Rewinder	2026-07-10 21:13:57.214109
120	6	REWINDER CRANE EAST/WEST	0.35	0.50	1350	1.20	\N	\N	Rewinder	2026-07-10 21:13:57.214109
121	7	REWINDER CRANE LEFT/RIGHT	0.35	0.50	800	1.20	\N	\N	Rewinder	2026-07-10 21:13:57.214109
122	8	KANTA CRANE UP/DOWN	2.20	3.00	960	4.20	\N	\N	Rewinder	2026-07-10 21:13:57.214109
123	9	KANTA CRANE EAST/WEST	0.13	0.50	1370	0.61	\N	\N	Rewinder	2026-07-10 21:13:57.214109
124	10	KANTA CRANE LEFT/RIGHT	0.35	0.50	800	1.40	\N	\N	Rewinder	2026-07-10 21:13:57.214109
125	1	NO-1 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-07-10 21:13:57.214109
126	2	NO-2 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-07-10 21:13:57.214109
127	3	NO-3 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-07-10 21:13:57.214109
128	4	NO-4 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-07-10 21:13:57.214109
129	5	BACK (WASTE) WATER TANK PUMP	7.50	10.00	1455	13.50	6308-2z	6208-2z	ETP	2026-07-10 21:13:57.214109
130	6	MCN-BLACK WATER PUMP -1	37.00	50.00	2950	64.00	6312-2Z	6312-2Z	ETP	2026-07-10 21:13:57.214109
131	7	MCN-BLACK WATER PUMP -2	15.00	20.00	1440	27.00	6309-2Z	6209-2Z	ETP	2026-07-10 21:13:57.214109
132	8	NO-1 TANK DOSING PUMP	1.50	2.00	940	4.20	6206-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
133	9	NO-2 TANK DOSING PUMP	1.50	2.00	1430	3.50	6205-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
134	10	NO-3 TANK DOSING PUMP	1.50	2.00	1430	3.50	6205-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
135	11	HIGH PRESSURE PUMP	37.00	50.00	2960	63.00	6312-2Z	6312-2Z	ETP	2026-07-10 21:13:57.214109
136	12	NO-2 PUMP (MONO BLOCK)	1.50	2.00	2800	\N	MONO BLOCK	MONO BLOCK	ETP	2026-07-10 21:13:57.214109
137	13	NO-3 PUMP (MONO BLOCK)	1.50	2.00	2800	\N	MONO BLOCK	MONO BLOCK	ETP	2026-07-10 21:13:57.214109
138	14	TANK AGITATOR MOTOR -1 -OFF STATE	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
139	15	TANK AGITATOR MOTOR -2	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
140	16	TANK AGITATOR MOTOR -3	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-07-10 21:13:57.214109
141	17	COMPRESSOR MOTOR	5.50	7.00	2900	\N	\N	6205-2Z	ETP	2026-07-10 21:13:57.214109
142	18	CRAFTER MOTOR	5.50	7.50	960	\N	\N	\N	ETP	2026-07-10 21:13:57.214109
143	1	ID FAN MOTOR	75.00	100.00	1480	123.00	6318-C3	6318-C3	Boiler	2026-07-10 21:13:57.214109
144	2	FD FAN MOTOR-1	30.00	40.00	2940	52.00	\N	\N	Boiler	2026-07-10 21:13:57.214109
145	3	FD FAN MOTOR-2	30.00	40.00	2940	52.00	\N	\N	Boiler	2026-07-10 21:13:57.214109
146	4	FEED PUMP-1	11.00	15.00	2920	20.00	\N	\N	Boiler	2026-07-10 21:13:57.214109
147	5	FEED PUMP-2	11.00	15.00	2920	20.00	\N	\N	Boiler	2026-07-10 21:13:57.214109
148	6	SCREW FEEDER NO-1	1.10	1.50	1440	2.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
149	7	SCREW FEEDER NO-2	1.10	1.50	1440	2.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
150	8	DUST CELANER (BALU)	1.50	2.00	1440	3.00	\N	\N	Boiler	2026-07-10 21:13:57.214109
151	9	ELEVATOR MOTOR- 1	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
152	10	ELEVATOR MOTOR- 2	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
153	11	DUST -ELEVATOR MOTOR- 3	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
154	12	SCANNER MOTOR (VIBRATOR)	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
155	13	CYCLONE BLOWER MOTOR	3.70	5.00	2875	6.80	\N	\N	Boiler	2026-07-10 21:13:57.214109
156	14	CYCLONE ROTARY MOTOR	0.75	1.00	\N	\N	\N	\N	Boiler	2026-07-10 21:13:57.214109
157	15	APH ROTARY MOTOR	0.35	0.50	1440	1.20	\N	\N	Boiler	2026-07-10 21:13:57.214109
158	16	APH -BLOWER MOTOR	0.75	1.00	2880	1.80	\N	\N	Boiler	2026-07-10 21:13:57.214109
159	17	SMOKE ROTARY MOTOR	0.75	1.00	1440	1.70	\N	\N	Boiler	2026-07-10 21:13:57.214109
160	18	HEAT CHAMBER MOTOR	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-07-10 21:13:57.214109
161	19	FEED WATER -AURO MOTOR	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-07-10 21:13:57.214109
162	20	SHARPENER MOTOR AURO	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-07-10 21:13:57.214109
163	21	REJECT WATER MOTOR	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-07-10 21:13:57.214109
164	22	BORE WATER NOTOR -MCN	3.70	5.00	\N	\N	\N	\N	Boiler	2026-07-10 21:13:57.214109
165	23	BORE WATER MOTOR -COLONY	3.70	5.00	\N	\N	\N	\N	Boiler	2026-07-10 21:13:57.214109
168	1	PULPER MOTOR -ABB	250.00	340.00	988	460.00	NU-322-C3	6316-C3	Pulp Mill	2026-08-06 18:46:18.144498
169	2	SCANNER MOTOR- CE	45.00	60.00	1475	81.00	6313-C3	6313-C3	Pulp Mill	2026-08-06 18:46:18.144498
170	3	SANDTRAP PUMP NO 2	18.50	25.00	1460	32.00	6310-C3	6210-C3	Pulp Mill	2026-08-06 18:46:18.144498
171	4	SANDTRAP PUMP NO 1	55.00	75.00	1485	101.00	6315-C3	6315-C3	Pulp Mill	2026-08-06 18:46:18.144498
172	5	DRUM CHEST PUMP	60.00	80.00	1475	104.00	6314-C3	6314-C3	Pulp Mill	2026-08-06 18:46:18.144498
173	6	DRUM CHEST AGITATOR	22.00	30.00	975	40.00	6312-C3	6212-C3	Pulp Mill	2026-08-06 18:46:18.144498
174	7	NO.1 CHEST PUMP	55.00	75.00	1475	92.00	6314-C3	6314-C3	Pulp Mill	2026-08-06 18:46:18.144498
175	8	NO.1 CHEST AGITATOR	22.00	30.00	975	40.00	6312-C3	6212-C3	Pulp Mill	2026-08-06 18:46:18.144498
176	9	NO.2 CHEST PUMP 1	30.00	40.00	1460	53.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-08-06 18:46:18.144498
177	10	NO.2 CHEST PUMP 2	22.00	30.00	1460	40.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-08-06 18:46:18.144498
178	11	NO.3 CHEST PUMP	30.00	40.00	1475	53.00	6312-2Z-CE	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
179	12	NO.3 CHEST AGITATOR	22.00	30.00	975	40.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-08-06 18:46:18.144498
180	13	NO.4 CHEST PUMP	15.00	20.00	1460	27.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-08-06 18:46:18.144498
181	14	NO.4 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
182	15	NO.5 CHEST PUMP	15.00	20.00	1460	27.00	6309-C3-2Z	6209-2Z	Pulp Mill	2026-08-06 18:46:18.144498
183	16	NO.5 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
184	17	NO.6 CHEST PUMP	22.00	30.00	1460	40.00	6310-2Z-C3	6210-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
185	18	NO.6 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
186	19	NO.7 CHEST PUMP	30.00	40.00	1475	53.00	6312-2Z-CE	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
187	20	NO.7 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
188	21	NO.8 CHEST PUMP	30.00	40.00	1470	54.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
189	22	NO.8 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
190	23	NO.9 CHEST PUMP-FRESH WATER	3.70	5.00	2800	8.20	\N	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
191	24	NO.9 CHEST AGITATOR	22.00	30.00	975	40.00	6312-2Z-C3	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
192	25	TDR- REFINER NO.1- 24"	315.00	425.00	744	588.00	6322--C3	6322--C3	Pulp Mill	2026-08-06 18:46:18.144498
193	26	TDR- REFINER NO.2- 21"	250.00	335.00	990	434.00	6322--C3	6322--C3	Pulp Mill	2026-08-06 18:46:18.144498
194	27	THICKNER	15.00	20.00	975	27.00	6310-2Z-C3	6210-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
195	28	TURBO NO.1 -900	90.00	120.00	1480	147.00	6318-C3	6318-C3	Pulp Mill	2026-08-06 18:46:18.144498
196	29	TURBO NO.2-450	37.00	50.00	1475	63.00	6313-C3	6213-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
197	30	AFT-PRESSURE SCREEN-1	45.00	60.00	1475	81.00	6313-C3	6313-C3	Pulp Mill	2026-08-06 18:46:18.144498
198	31	AFT-PRESSURE SCREEN-2	37.00	50.00	980	66.00	6314-C3	6314-C3	Pulp Mill	2026-08-06 18:46:18.144498
199	32	AFT-PRESSURE SCREEN-3	37.00	50.00	1475	63.00	6313-C3	6213-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
200	33	AFT-PRESSURE SCREEN-4	30.00	40.00	1465	53.00	6312-C3-2Z	6212-2Z-C3	Pulp Mill	2026-08-06 18:46:18.144498
201	34	CONVEYOR BELT MOTOR	5.00	7.50	1455	85.00	\N	\N	Pulp Mill	2026-08-06 18:46:18.144498
202	35	PULP MILL CRANE SIDE -1	0.75	1.00	1410	1.60	6004-2Z	6004-2Z	Pulp Mill	2026-08-06 18:46:18.144498
203	36	PULP MILL CRANE SIDE -2	0.75	1.00	1410	1.60	6004-2Z	6004-2Z	Pulp Mill	2026-08-06 18:46:18.144498
204	37	PULP MILL CRANE -L/R	0.35	0.50	1410	\N	\N	\N	Pulp Mill	2026-08-06 18:46:18.144498
205	38	PULP MILL CRANE -U/D	2.20	3.00	1410	4.50	\N	\N	Pulp Mill	2026-08-06 18:46:18.144498
206	39	AFT PRESSURE SCREEN BLOWER	0.37	0.50	1410	1.70	\N	\N	Pulp Mill	2026-08-06 18:46:18.144498
207	40	BACK WATER PUMP SIDE	3.30	5.00	1450	7.50	\N	\N	Pulp Mill	2026-08-06 18:46:18.144498
208	1	BOTTOM BLOWER HEADBOX	3.70	5.00	1440	7.10	6306-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
209	2	CHEMICAL AGITATOR	3.70	5.00	1425	7.50	6206-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
210	3	DOGING PUMP NO.1	0.37	0.50	1400	1.09	6003-2Z	6003-2Z	Machine	2026-08-06 18:46:18.144498
211	4	DOGING PUMP NO.2	0.37	0.50	1400	1.09	6003-2Z	6003-2Z	Machine	2026-08-06 18:46:18.144498
212	5	CENTI CLAEANER TOP	30.00	40.00	1465	53.00	6312-2Z	6212-2Z	Machine	2026-08-06 18:46:18.144498
213	6	CENTI CLEANER MOTOR NO.1 BOTTOM	30.00	40.00	1465	53.00	6312-2Z	6212-2Z	Machine	2026-08-06 18:46:18.144498
214	7	CENTI CLEANER MOTOR NO.2 BOTTOM	11.00	15.00	1460	21.00	6306-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
215	8	TOP PRESSURE SCREEN	45.00	60.00	1480	76.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
216	9	BOTTOM FAN PUMP	132.00	180.00	1490	214.00	6319-C3	6319-C3	Machine	2026-08-06 18:46:18.144498
217	10	TOP FAN PUMP	75.00	100.00	1480	123.00	6318-C3	6319-C3	Machine	2026-08-06 18:46:18.144498
218	11	VACCUM PUMP NO.1	160.00	220.00	988	275.00	6322-C3	6322-C3	Machine	2026-08-06 18:46:18.144498
219	12	VACCUM PUMP NO.2	110.00	150.00	1485	175.00	6319-C3	6319-C3	Machine	2026-08-06 18:46:18.144498
220	13	VACCUM PUMP NO.3	160.00	220.00	989	280.00	6319-C3	6319-C3	Machine	2026-08-06 18:46:18.144498
221	14	NO.1 VACCUM SEPRATOR	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Machine	2026-08-06 18:46:18.144498
222	15	NO.2 VACCUM SEPRATOR	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Machine	2026-08-06 18:46:18.144498
223	16	COUCH ROLL MOTOR	220.00	300.00	1486	350.00	6322-C3	6322-C3	Machine	2026-08-06 18:46:18.144498
224	17	BOTTOM PRESSURE SCREEN	45.00	60.00	1480	76.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
225	18	NO.1 PRESS MOTOR -TOP	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-08-06 18:46:18.144498
226	19	NO.2 PRESS MOTOR -TOP	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-08-06 18:46:18.144498
227	20	NO.2 PRESS MOTOR -BOTTOM	75.00	100.00	1480	123.00	6318-C3	6318-C3	Machine	2026-08-06 18:46:18.144498
228	21	FIRST DRYER MOTOR	75.00	100.00	1480	126.00	6318-C3	6318-C3	Machine	2026-08-06 18:46:18.144498
229	22	SECOND DRYER MOTOR	75.00	100.00	1480	126.00	6318-C3	6318-C3	Machine	2026-08-06 18:46:18.144498
230	23	CONDENSER PUMP NO.1	3.70	5.00	2800	7.80	\N	\N	Machine	2026-08-06 18:46:18.144498
231	24	CONDENSER PUMP NO.2	1.10	2.00	2800	3.40	\N	\N	Machine	2026-08-06 18:46:18.144498
232	25	POPE REEL MOTOR	45.00	60.00	1475	76.00	6314-2Z	6314-2Z	Machine	2026-08-06 18:46:18.144498
233	26	POPE REEL ARM MOTOR	1.10	2.00	1440	7.20	6206-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
234	27	CALENDAR ROLL MOTOR	55.00	75.00	1475	92.00	6314-2Z	6314-2Z	Machine	2026-08-06 18:46:18.144498
235	28	NO.3 DRYER GEAR MOTOR 1	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-08-06 18:46:18.144498
236	29	NO.3 DRYER GEAR MOTOR 2	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-08-06 18:46:18.144498
237	30	NO.3 DRYER GEAR MOTOR 3	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-08-06 18:46:18.144498
238	31	NO.3 DRYER GEAR MOTOR 4	15.00	20.00	1460	27.00	6309-2Z	6309-2Z	Machine	2026-08-06 18:46:18.144498
239	32	HYDRAULIC PUMP NO.1- POPE REEL	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
240	33	HYDRAULIC PUMP NO.2 POPE REEL	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
241	34	HYDRAULIC PUMP NO.3 PRESS	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
242	35	HYDRAULIC PUMP NO.4 PRESS	3.50	5.00	1430	7.40	6306-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
243	36	BACK WATER REMOVAL PUMP -OFF	11.00	15.00	2925	19.00	6309-2Z	6209-2Z	Machine	2026-08-06 18:46:18.144498
244	37	SIZE PRESS ROLL TOP MOTOR	37.00	50.00	1480	63.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
245	38	SIZE PRESS ROLL BOTTOM MOTOR	37.00	50.00	1480	63.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
246	39	KUT -PIT MOTOR	22.00	30.00	1475	43.00	6312-2Z	6212-2Z	Machine	2026-08-06 18:46:18.144498
247	40	TOP WIRE MOTOR	45.00	60.00	1475	73.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
248	41	BOTTOM WIRE MOTOR	45.00	60.00	1475	73.00	6313-2Z	6213-2Z	Machine	2026-08-06 18:46:18.144498
249	42	TOP HEAD BOX BLOWER MOTOR	3.70	5.00	1440	7.00	6306-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
250	43	TOP HEAD BOX HOLY ROLL-1 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
251	44	TOP HEAD BOX HOLY ROLL-2 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
252	45	BOTTOM HEAD BOX HOLY ROLL -1 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
253	46	BOTTOM HEAD BOX HOLY ROLL -2 MOTOR	1.50	2.00	1450	3.20	6205-2Z	6205-2Z	Machine	2026-08-06 18:46:18.144498
254	47	WIRE HIGH PRESSURE PUMP	3.70	5.00	1450	\N	\N	6205-2Z	Machine	2026-08-06 18:46:18.144498
255	48	WIRE SHOWER MOTOR	1.10	2.00	2900	8.00	\N	\N	Machine	2026-08-06 18:46:18.144498
256	49	COMPRESSOR MOTOR -1	30.00	40.00	2900	52.00	\N	\N	Machine	2026-08-06 18:46:18.144498
257	50	COMPRESSOR MOTOR-2	30.00	40.00	2900	52.00	\N	\N	Machine	2026-08-06 18:46:18.144498
258	51	MACHINE CRANE MOTOR UP/DOWN	10.00	15.00	915	21.00	slipring motor-Dc	\N	Machine	2026-08-06 18:46:18.144498
259	52	MACHINE CRANE MOTOR LEFT	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
260	53	MACHINE CRANE MOTOR RIGHT	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
261	54	MACHINE CRANE MOTOR EAST-WEST	3.70	5.00	920	9.10	6206-2Z	6206-2Z	Machine	2026-08-06 18:46:18.144498
262	55	MACHINE CRANE BREAK DRUM MOTOR	0.75	1.00	880	1.90	\N	\N	Machine	2026-08-06 18:46:18.144498
263	56	LOADING CRANE LEFT	0.75	1.00	880	1.90	\N	\N	Machine	2026-08-06 18:46:18.144498
264	57	LOADING CRANE RIGHT	0.75	1.00	880	1.90	\N	\N	Machine	2026-08-06 18:46:18.144498
265	58	LOADING CRANE EAST-WEST	0.75	1.00	1440	2.00	\N	\N	Machine	2026-08-06 18:46:18.144498
266	59	LOADING CRANE UP/DOWN	7.50	10.00	1440	13.00	\N	\N	Machine	2026-08-06 18:46:18.144498
267	60	WATER REMOVAL PUMP- BOOTTOM FAN	2.20	3.00	2800	4.20	\N	\N	Machine	2026-08-06 18:46:18.144498
268	61	COUCH-PIT WATER REMOVALPUMP	2.20	3.00	2800	4.20	\N	\N	Machine	2026-08-06 18:46:18.144498
269	62	TOP PRESSURE SCREEN BLOWER	0.37	0.50	1410	1.70	\N	\N	Machine	2026-08-06 18:46:18.144498
270	1	AGITATOR TANK-1	2.20	3.00	1440	4.20	\N	\N	Starch	2026-08-06 18:46:18.144498
271	2	AGITATOR TANK-2	2.20	3.00	1440	4.20	\N	\N	Starch	2026-08-06 18:46:18.144498
272	3	AGITATOR TANK-3	2.20	3.00	1440	4.20	\N	\N	Starch	2026-08-06 18:46:18.144498
273	4	NO.1 PUMP (size press pump)	5.50	7.50	1450	10.50	6308-2Z	6208-2Z	Starch	2026-08-06 18:46:18.144498
274	5	NO.4 PUMP (SIZE PRESS PUMP)	2.20	3.00	1440	\N	MONO BLOCK	\N	Starch	2026-08-06 18:46:18.144498
275	6	NO.5 PUMP	2.20	3.00	2800	\N	\N	\N	Starch	2026-08-06 18:46:18.144498
276	7	NO.7 PUMP (EMERGENCY -ON)	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-08-06 18:46:18.144498
277	8	NO.8 PUMP	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-08-06 18:46:18.144498
278	9	NO.10 PUMP (EMERGENCY -ON)	3.70	5.00	1440	7.10	6306-2Z	6206-2Z	Starch	2026-08-06 18:46:18.144498
279	10	BACK(WASTE) WATER REMOVAL PUMP	5.50	7.50	1450	10.00	6308-2Z	6208-2Z	Starch	2026-08-06 18:46:18.144498
280	11	DRILL MCN MOTOR	1.50	2.00	1440	4.40	\N	\N	Starch	2026-08-06 18:46:18.144498
281	12	LIGHT MCN	2.20	3.00	1440	5.00	\N	\N	Starch	2026-08-06 18:46:18.144498
282	1	MAIN MOTOR -1	75.00	100.00	1480	123.00	6318-C3	6318-C3	Rewinder	2026-08-06 18:46:18.144498
283	2	MAIN MOTOR -2	75.00	100.00	1480	123.00	6318-C3	6318-C3	Rewinder	2026-08-06 18:46:18.144498
284	3	BLOWER MOTOR	15.00	20.00	2920	26.00	6310-2Z	6210-2Z	Rewinder	2026-08-06 18:46:18.144498
285	4	CORE PIPE MOTOR	2.30	3.00	1440	4.60	\N	\N	Rewinder	2026-08-06 18:46:18.144498
286	5	REWINDER CRANE UP/DOWN	2.20	3.00	960	4.20	\N	\N	Rewinder	2026-08-06 18:46:18.144498
287	6	REWINDER CRANE EAST/WEST	0.35	0.50	1350	1.20	\N	\N	Rewinder	2026-08-06 18:46:18.144498
288	7	REWINDER CRANE LEFT/RIGHT	0.35	0.50	800	1.20	\N	\N	Rewinder	2026-08-06 18:46:18.144498
289	8	KANTA CRANE UP/DOWN	2.20	3.00	960	4.20	\N	\N	Rewinder	2026-08-06 18:46:18.144498
290	9	KANTA CRANE EAST/WEST	0.13	0.50	1370	0.61	\N	\N	Rewinder	2026-08-06 18:46:18.144498
291	10	KANTA CRANE LEFT/RIGHT	0.35	0.50	800	1.40	\N	\N	Rewinder	2026-08-06 18:46:18.144498
292	1	NO-1 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-08-06 18:46:18.144498
293	2	NO-2 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-08-06 18:46:18.144498
294	3	NO-3 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-08-06 18:46:18.144498
295	4	NO-4 PUMP	5.50	7.50	1450	10.00	6308-2z	6208-2z	ETP	2026-08-06 18:46:18.144498
296	5	BACK (WASTE) WATER TANK PUMP	7.50	10.00	1455	13.50	6308-2z	6208-2z	ETP	2026-08-06 18:46:18.144498
297	6	MCN-BLACK WATER PUMP -1	37.00	50.00	2950	64.00	6312-2Z	6312-2Z	ETP	2026-08-06 18:46:18.144498
298	7	MCN-BLACK WATER PUMP -2	15.00	20.00	1440	27.00	6309-2Z	6209-2Z	ETP	2026-08-06 18:46:18.144498
299	8	NO-1 TANK DOSING PUMP	1.50	2.00	940	4.20	6206-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
300	9	NO-2 TANK DOSING PUMP	1.50	2.00	1430	3.50	6205-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
301	10	NO-3 TANK DOSING PUMP	1.50	2.00	1430	3.50	6205-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
302	11	HIGH PRESSURE PUMP	37.00	50.00	2960	63.00	6312-2Z	6312-2Z	ETP	2026-08-06 18:46:18.144498
303	12	NO-2 PUMP (MONO BLOCK)	1.50	2.00	2800	\N	MONO BLOCK	MONO BLOCK	ETP	2026-08-06 18:46:18.144498
304	13	NO-3 PUMP (MONO BLOCK)	1.50	2.00	2800	\N	MONO BLOCK	MONO BLOCK	ETP	2026-08-06 18:46:18.144498
305	14	TANK AGITATOR MOTOR -1 -OFF STATE	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
306	15	TANK AGITATOR MOTOR -2	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
307	16	TANK AGITATOR MOTOR -3	2.20	3.00	935	4.50	6306-2Z	6205-2Z	ETP	2026-08-06 18:46:18.144498
308	17	COMPRESSOR MOTOR	5.50	7.00	2900	\N	\N	6205-2Z	ETP	2026-08-06 18:46:18.144498
309	18	CRAFTER MOTOR	5.50	7.50	960	\N	\N	\N	ETP	2026-08-06 18:46:18.144498
310	1	ID FAN MOTOR	75.00	100.00	1480	123.00	6318-C3	6318-C3	Boiler	2026-08-06 18:46:18.144498
311	2	FD FAN MOTOR-1	30.00	40.00	2940	52.00	\N	\N	Boiler	2026-08-06 18:46:18.144498
312	3	FD FAN MOTOR-2	30.00	40.00	2940	52.00	\N	\N	Boiler	2026-08-06 18:46:18.144498
313	4	FEED PUMP-1	11.00	15.00	2920	20.00	\N	\N	Boiler	2026-08-06 18:46:18.144498
314	5	FEED PUMP-2	11.00	15.00	2920	20.00	\N	\N	Boiler	2026-08-06 18:46:18.144498
315	6	SCREW FEEDER NO-1	1.10	1.50	1440	2.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
316	7	SCREW FEEDER NO-2	1.10	1.50	1440	2.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
317	8	DUST CELANER (BALU)	1.50	2.00	1440	3.00	\N	\N	Boiler	2026-08-06 18:46:18.144498
318	9	ELEVATOR MOTOR- 1	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
319	10	ELEVATOR MOTOR- 2	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
320	11	DUST -ELEVATOR MOTOR- 3	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
321	12	SCANNER MOTOR (VIBRATOR)	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
322	13	CYCLONE BLOWER MOTOR	3.70	5.00	2875	6.80	\N	\N	Boiler	2026-08-06 18:46:18.144498
323	14	CYCLONE ROTARY MOTOR	0.75	1.00	\N	\N	\N	\N	Boiler	2026-08-06 18:46:18.144498
324	15	APH ROTARY MOTOR	0.35	0.50	1440	1.20	\N	\N	Boiler	2026-08-06 18:46:18.144498
325	16	APH -BLOWER MOTOR	0.75	1.00	2880	1.80	\N	\N	Boiler	2026-08-06 18:46:18.144498
326	17	SMOKE ROTARY MOTOR	0.75	1.00	1440	1.70	\N	\N	Boiler	2026-08-06 18:46:18.144498
327	18	HEAT CHAMBER MOTOR	3.70	5.00	1440	7.50	\N	\N	Boiler	2026-08-06 18:46:18.144498
328	19	FEED WATER -AURO MOTOR	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-08-06 18:46:18.144498
329	20	SHARPENER MOTOR AURO	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-08-06 18:46:18.144498
330	21	REJECT WATER MOTOR	3.70	5.00	2880	6.70	\N	\N	Boiler	2026-08-06 18:46:18.144498
331	22	BORE WATER NOTOR -MCN	3.70	5.00	\N	\N	\N	\N	Boiler	2026-08-06 18:46:18.144498
332	23	BORE WATER MOTOR -COLONY	3.70	5.00	\N	\N	\N	\N	Boiler	2026-08-06 18:46:18.144498
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, ref_table, ref_id, is_read, created_at) FROM stdin;
1	1	critical	Critical bearing: Bottom Wire Tension Roll-3	Bottom Wire Tension Roll-3 flagged Critical (F/S) during Night shift bearing check.	equipment_inspection	4	f	2026-07-10 19:19:37.154374+05:30
2	2	critical	Critical bearing: Bottom Wire Tension Roll-3	Bottom Wire Tension Roll-3 flagged Critical (F/S) during Night shift bearing check.	equipment_inspection	4	f	2026-07-10 19:19:37.179892+05:30
3	10	critical	Critical bearing: Bottom Wire Tension Roll-3	Bottom Wire Tension Roll-3 flagged Critical (F/S) during Night shift bearing check.	equipment_inspection	4	f	2026-07-10 19:19:37.184042+05:30
\.


--
-- Data for Name: onboarding_checklist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.onboarding_checklist (id, employee_id, task_id, due_date, status, completed_by, completed_on, notes, created_at) FROM stdin;
\.


--
-- Data for Name: onboarding_tasks_master; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.onboarding_tasks_master (id, task_title, responsible, dept_code, due_days, is_active, sort_order) FROM stdin;
1	Collect signed offer letter	HR	\N	0	t	1
2	Issue appointment letter	HR	\N	1	t	2
3	Collect ID proof (Aadhaar + PAN)	HR	\N	1	t	3
4	Open bank account / collect bank details	Finance	\N	3	t	4
5	PF registration (UAN activation)	HR	\N	3	t	5
6	ESIC registration (if applicable)	HR	\N	3	t	6
7	Issue company ID card + access card	HR	\N	2	t	7
8	Laptop / workstation provisioning	IT	\N	1	t	8
9	Email account creation	IT	\N	1	t	9
10	ERP system access setup	IT	\N	2	t	10
11	Department orientation session	Dept Head	\N	1	t	11
12	Safety induction training	EHS	\N	1	t	12
13	Introduce to team members	Dept Head	\N	1	t	13
14	Review job description with manager	Dept Head	\N	3	t	14
15	Set 30-day onboarding goals	Dept Head	\N	5	t	15
16	Collect educational certificates (attested)	HR	\N	7	t	16
17	Medical examination (if required)	HR	\N	7	t	17
18	Add to payroll	Finance	\N	3	t	18
19	Confirm probation period end date	HR	\N	1	t	19
20	30-day check-in meeting with HR	HR	\N	30	t	20
21	Collect signed offer letter	HR	\N	0	t	1
22	Issue appointment letter	HR	\N	1	t	2
23	Collect ID proof (Aadhaar + PAN)	HR	\N	1	t	3
24	Open bank account / collect bank details	Finance	\N	3	t	4
25	PF registration (UAN activation)	HR	\N	3	t	5
26	ESIC registration (if applicable)	HR	\N	3	t	6
27	Issue company ID card + access card	HR	\N	2	t	7
28	Laptop / workstation provisioning	IT	\N	1	t	8
29	Email account creation	IT	\N	1	t	9
30	ERP system access setup	IT	\N	2	t	10
31	Department orientation session	Dept Head	\N	1	t	11
32	Safety induction training	EHS	\N	1	t	12
33	Introduce to team members	Dept Head	\N	1	t	13
34	Review job description with manager	Dept Head	\N	3	t	14
35	Set 30-day onboarding goals	Dept Head	\N	5	t	15
36	Collect educational certificates (attested)	HR	\N	7	t	16
37	Medical examination (if required)	HR	\N	7	t	17
38	Add to payroll	Finance	\N	3	t	18
39	Confirm probation period end date	HR	\N	1	t	19
40	30-day check-in meeting with HR	HR	\N	30	t	20
\.


--
-- Data for Name: packing_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.packing_records (id, pack_number, date, reel_id, packing_type, wrap_material, net_weight_kg, gross_weight_kg, label_printed, packed_by, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, payment_number, sales_order_id, amount, payment_date, payment_mode, reference_number, recorded_by, remarks, created_at, status, confirmed_by, confirmed_at) FROM stdin;
2	PY-20260710-0001	1	5000.00	2026-07-10	Bank	\N	1	\N	2026-07-10 19:59:54.597617	Confirmed	1	2026-07-10 19:59:54.864552
3	PY-20260710-0002	1	1000.00	2026-07-10	Cash	\N	6	\N	2026-07-10 20:00:06.376596	Pending	\N	\N
\.


--
-- Data for Name: payroll_details; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payroll_details (id, payroll_run_id, employee_id, salary_structure_id, working_days, present_days, lop_days, basic, hra, da, conveyance, medical, special_allowance, overtime_amount, other_earnings, gross_salary, pf_employee, pf_employer, esic_employee, esic_employer, professional_tax, tds, advance_recovery, loan_recovery, other_deductions, total_deductions, net_salary, payment_mode, payment_status, payment_date, transaction_ref, created_at) FROM stdin;
\.


--
-- Data for Name: payroll_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payroll_runs (id, month, status, total_employees, total_gross, total_deductions, total_net, generated_by, approved_by, paid_by, approved_at, paid_at, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: payrolls; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payrolls (id, employee_id, month, present_days, basic_salary, allowances, deductions, net_salary, status, paid_date, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: plant_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plant_sections (id, section_code, name, icon, description, sort_order, is_active, created_at, department_id) FROM stdin;
1	ALL	All Sections	🌐	Unified plant-wide aggregator dashboard	0	t	2026-06-29 14:17:00.121296	\N
2	PULP	Pulp Mill	🪵	Converts raw fiber into clean refined pulp	1	t	2026-06-29 14:17:00.121296	1
3	CENTRI	Centricleaner	🌀	Centrifugal removal of fine/heavy contaminants	2	t	2026-06-29 14:17:00.121296	1
4	WIRE	Wire Section	🕸️	Sheet forming — dilute stock drained through forming fabric	3	t	2026-06-29 14:17:00.121296	1
5	VACUUM	Vacuum	💨	Controlled vacuum for wire/press/felt dewatering	4	t	2026-06-29 14:17:00.121296	1
6	PRESS	Press Section	🗜️	Mechanical water removal — 20% to 42–50% dryness	5	t	2026-06-29 14:17:00.121296	1
7	UNIRUN	Unirun	🏃	Single-felt closed draw transfer press→dryer	6	t	2026-06-29 14:17:00.121296	1
8	PREDRYER	Pre Dryer	🔥	Steam-heated cylinders — 50% to 92–95% dryness	7	t	2026-06-29 14:17:00.121296	1
9	SIZEPRESS	Size Press	📏	Surface starch/sizing application	8	t	2026-06-29 14:17:00.121296	1
10	SIZEKITCHEN	Size Kitchen	🍳	Starch cooking and supply for size press	9	t	2026-06-29 14:17:00.121296	1
11	POSTDRYER	Post Dryer	☀️	Final drying after size press to 94–96%	10	t	2026-06-29 14:17:00.121296	1
12	CALENDER	Calender	🛢️	Smoothness/gloss/caliper improvement via nip	11	t	2026-06-29 14:17:00.121296	1
13	POPE	Pope Reel	⭕	Winds finished paper into parent jumbo reel	12	t	2026-06-29 14:17:00.121296	1
14	REWINDER	Rewinder	🔄	Slits parent reel into customer roll specs	13	t	2026-06-29 14:17:00.121296	1
15	STARCHKITCHEN	Starch Kitchen	🧪	Wet-end starch preparation for retention/strength	14	t	2026-06-29 14:17:00.121296	1
20	CRANES	Cranes	🏗️	Material handling — EOT/Gantry/Jib hoists	19	t	2026-06-29 14:17:00.121296	8
16	STEAMCOND	Steam & Condensate	💧	Steam distribution and condensate recovery circuit	15	t	2026-06-29 14:17:00.121296	9
17	ETP	ETP	🍀	Effluent treatment — primary/secondary/tertiary	16	t	2026-06-29 14:17:00.121296	9
18	BOILER	Boiler	🌋	Steam generation and co-generation	17	t	2026-06-29 14:17:00.121296	9
21	COMPRESSORS	Compressors & Air Dryer	🌬️	Instrument air and service air generation	20	t	2026-06-29 14:17:00.121296	9
19	LAB	Lab	🔬	Quality control testing of RM/in-process/FG	18	t	2026-06-29 14:17:00.121296	14
85	STORE	Store Section	🏪	Raw material, spares, and consumables inventory storage.	30	t	2026-07-06 01:37:38.590383	4
\.


--
-- Data for Name: po_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.po_items (id, po_id, material_id, qty, received_qty, uom, unit_price, gst_pct, total) FROM stdin;
\.


--
-- Data for Name: production_summary; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.production_summary (id, date, shift_type, machine_id, total_reels, total_production_kg, total_reject_kg, net_production_kg, avg_gsm, avg_moisture, avg_speed, avg_efficiency, total_downtime_min, total_steam, total_water, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_orders (id, po_number, date, vendor_id, indent_id, delivery_date, payment_terms, status, total_value, gst_value, grand_total, approved_by, created_by, remarks, created_at) FROM stdin;
1	PO-20260710-0001	2026-07-10	1	\N	\N	\N	Approved	500.00	90.00	590.00	1	1	\N	2026-07-10 19:59:14.556107
2	PO-20260710-0002	2026-07-10	1	\N	\N	\N	Draft	50.00	9.00	59.00	\N	6	\N	2026-07-10 19:59:31.131158
\.


--
-- Data for Name: quality_lab_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quality_lab_tests (id, reel_id, section_id, shift_id, test_time, freeness_csf, consistency_pct, basis_weight_gsm, burst_factor, moisture_pct, tensile_md, tensile_cd, cobb_size, dirt_count, trim_loss_mm, slit_count, lab_by, remarks, created_at) FROM stdin;
1	\N	1	\N	2026-07-05 18:46:58.884427	420.00	\N	80.500	22.00	6.20	\N	\N	\N	0.500	\N	\N	3	\N	2026-07-05 18:46:58.884427
2	\N	1	\N	2026-07-05 18:52:25.742973	390.00	\N	80.200	21.50	6.40	\N	\N	\N	0.800	\N	\N	3	\N	2026-07-05 18:52:25.742973
\.


--
-- Data for Name: quality_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quality_tests (id, test_number, test_type, reference_type, reference_id, tested_by, test_date, gsm, moisture_pct, caliper_micron, burst_factor, cobb_value, brightness_pct, thickness_micron, width_mm, weight_kg, tensile_strength, tear_strength, result, remarks, created_at) FROM stdin;
1	QT-20260705-0001	Incoming	GRN	\N	1	2026-07-05 19:35:44.645005	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Pending	\N	2026-07-05 19:35:44.645005
2	QT-20260710-0001	GSM	\N	\N	6	2026-07-10 19:38:26.062132	80.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Pending	\N	2026-07-10 19:38:26.062132
\.


--
-- Data for Name: reels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reels (id, reel_number, barcode, shift_id, machine_id, grade_id, operator_id, gsm, width_mm, length_m, weight_kg, moisture_pct, speed_mpm, steam_pressure, steam_consumption, water_consumption, start_time, end_time, production_time_min, break_time_min, downtime_min, efficiency_pct, reject_pct, quality_status, sales_order_id, rack_location, status, remarks, created_at, updated_at, bf, deckle, reject_reason) FROM stdin;
31	MK-20260705-PM1-0001	MK-MK-20260705-PM1-0001-1783254563771	\N	1	1	1	120.00	1800.00	5000.00	950.500	6.80	\N	\N	\N	\N	\N	\N	45	\N	\N	100.00	\N	Pending	\N	\N	In Production	Integration test reel	2026-07-05 17:59:23.767087	2026-07-05 17:59:23.767087	20	1820.50	\N
32	MK-20260705-PM1-0002	MK-MK-20260705-PM1-0002-1783254578452	\N	1	1	1	120.00	1800.00	5000.00	950.500	6.80	\N	\N	\N	\N	\N	\N	45	\N	\N	100.00	\N	Pending	\N	\N	In Production	Integration test reel	2026-07-05 17:59:38.452653	2026-07-05 17:59:38.452653	20	1820.50	\N
33	MK-20260705-PM1-0003	MK-MK-20260705-PM1-0003-1783256616087	\N	1	1	1	120.00	1800.00	5000.00	950.500	6.80	\N	\N	\N	\N	\N	\N	45	\N	\N	100.00	\N	Pending	\N	\N	In Production	Integration test reel	2026-07-05 18:33:36.082502	2026-07-05 18:33:36.082502	20	1820.50	\N
34	MK-20260705-PM1-0004	MK-MK-20260705-PM1-0004-1783277096294	1	1	1	12	2.00	23.00	232.00	222.000	12.00	\N	\N	\N	\N	\N	\N	23	\N	\N	100.00	23.00	Pending	\N	\N	In Production	\N	2026-07-06 00:14:56.293375	2026-07-06 00:14:56.293375	23	\N	\N
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name, level, permissions, created_at) FROM stdin;
1	Operator	1	{"view": true, "entry": true}	2026-06-26 18:13:01.372505
2	Shift Supervisor	2	{"view": true, "entry": true, "approve_l1": true}	2026-06-26 18:13:01.372505
3	Manager	3	{"view": true, "entry": true, "approve_l1": true, "approve_l2": true}	2026-06-26 18:13:01.372505
4	Plant Head	4	{"view": true, "entry": true, "approve_l1": true, "approve_l2": true, "approve_l3": true}	2026-06-26 18:13:01.372505
5	Admin	5	{"view": true, "entry": true, "approve_l1": true, "approve_l2": true, "approve_l3": true, "manage_users": true, "manage_system": true}	2026-06-26 18:13:01.372505
\.


--
-- Data for Name: salary_structures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.salary_structures (id, code, name, grade, basic_pct, hra_pct, da_pct, conv_fixed, medical_fixed, special_pct, is_active, created_at) FROM stdin;
1	STR-WORKER	Worker Grade	W	60.00	40.00	20.00	1600.00	1250.00	0.00	t	2026-06-30 23:52:52.950125+05:30
2	STR-SUPERVISOR	Supervisor Grade	S	50.00	40.00	15.00	1600.00	1250.00	0.00	t	2026-06-30 23:52:52.950125+05:30
3	STR-MANAGER	Manager Grade	M	45.00	40.00	10.00	1600.00	1250.00	0.00	t	2026-06-30 23:52:52.950125+05:30
4	STR-HEAD	Department Head	H	40.00	40.00	10.00	2000.00	1250.00	0.00	t	2026-06-30 23:52:52.950125+05:30
5	STR-ADMIN	Admin / Senior Staff	A	40.00	40.00	10.00	2000.00	1250.00	0.00	t	2026-06-30 23:52:52.950125+05:30
\.


--
-- Data for Name: sales_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_orders (id, so_number, date, customer_id, delivery_date, grade_id, gsm, width_mm, qty_mt, fulfilled_mt, rate_per_kg, total_value, status, remarks, created_by, created_at) FROM stdin;
1	SO-20260710-0001	2026-07-10	1	\N	1	\N	\N	1.000	0.000	50.00	50000.00	Pending	\N	1	2026-07-10 19:59:54.363869
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (filename, applied_at) FROM stdin;
phase3_migration.sql	2026-06-29 00:14:06.232566
migration_phase14.sql	2026-06-29 00:14:06.266192
migration_store_indents.sql	2026-06-29 09:10:11.55995
migration_dept_categories.sql	2026-06-29 09:48:42.907258
seed_logins.sql	2026-06-29 09:48:42.952885
migration_approval_matrix.sql	2026-06-29 10:28:42.199675
migration_paper_forms.sql	2026-06-29 10:41:46.294316
migration_critical_fixes.sql	2026-06-29 10:52:19.791046
migration_traceability.sql	2026-06-29 11:01:06.709966
migration_seed_sections.sql	2026-06-29 13:37:22.464509
migrate_holidays_loans.sql	2026-06-30 23:52:52.947545
migration_hrms_ph16.sql	2026-06-30 23:52:53.116976
seed_leave_balances.sql	2026-06-30 23:52:53.133356
migration_hrms_employee_cols.sql	2026-07-01 00:00:45.062381
migration_daily_production_report.sql	2026-07-01 00:17:38.476463
migration_dpr_engine.sql	2026-07-01 00:24:19.233092
migration_cmms_spares.sql	2026-07-05 17:20:38.194903
migration_piimas.sql	2026-07-05 17:20:38.202008
migration_plant_sections.sql	2026-07-05 17:20:38.205385
migration_reels_ph17d.sql	2026-07-05 17:27:10.132605
migration_downtime_reason_code_id.sql	2026-07-05 17:39:00.448982
migration_grade_fidelity_ph17e.sql	2026-07-05 17:53:23.917298
migration_equipment_seed_ph17f.sql	2026-07-05 18:33:01.928881
migration_deep_analysis_ph19_22.sql	2026-07-06 00:38:32.509463
migration_dps_excel_fields.sql	2026-07-06 00:38:32.515948
migration_production_enhancements.sql	2026-07-06 00:52:52.459367
migration_scada_boiler_energy.sql	2026-07-06 01:20:38.355824
migration_bearing_check_columns.sql	2026-07-10 18:57:26.017398
migration_bearing_equipment_seed.sql	2026-07-10 18:59:30.224425
migration_payment_confirm.sql	2026-07-10 19:33:00.400362
migration_scrap_remarks_column.sql	2026-07-10 19:51:00.432639
migration_adjustment_approval.sql	2026-07-10 20:13:55.306805
migration_bearing_scan_photo.sql	2026-07-10 21:01:22.791792
migration_motor_electrical_specs.sql	2026-07-10 21:13:07.374802
migration_bearing_readings_expand.sql	2026-07-10 21:34:57.181776
migration_store_shift_tracking.sql	2026-07-12 08:19:32.952263
migration_inventory_category_reset.sql	2026-07-14 16:34:03.570283
migration_materials_bin_location.sql	2026-07-15 18:37:48.072677
seed_motor_electrical_specs.sql	2026-08-06 18:46:18.144498
seed_store_inventory_import.sql	2026-08-06 18:46:18.178606
\.


--
-- Data for Name: scrap_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scrap_records (id, scrap_number, date, scrap_type, source_department_id, quantity_kg, description, disposal_method, buyer_name, sale_amount, recorded_by, status, created_at, remarks) FROM stdin;
1	SCR-20260710-0001	2026-07-10	Paper Waste	1	10.000	test	\N	\N	0.00	1	Pending	2026-07-10 19:51:11.43897	test remark
\.


--
-- Data for Name: section_alarms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_alarms (id, section_id, equipment_id, tag_name, alarm_code, alarm_type, description, triggered_at, acknowledged_at, acknowledged_by, resolved_at, resolution_note, maintenance_log_id, created_at) FROM stdin;
\.


--
-- Data for Name: section_energy_allocations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_energy_allocations (id, allocated_date, section_id, power_kwh, steam_mt, water_kl, created_at) FROM stdin;
2	2026-07-06	11	12000.50	45.20	180.00	2026-07-06 01:25:54.15506+05:30
\.


--
-- Data for Name: section_equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_equipment (id, section_id, machine_id, tag_name, equipment_name, equipment_type, manufacturer, model_number, serial_number, installation_date, rated_capacity, design_pressure, design_temp, motor_kw, rpm, is_critical, is_active, remarks, created_at) FROM stdin;
1	2	1	PULP-REF-01	PM1 Refiner 1	Refiner	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
2	2	2	PULP-REF-02	PM2 Refiner 1	Refiner	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
3	3	1	PM1-CENT-01	PM1 Centricleaner Bank	Cleaner	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
4	3	2	PM2-CENT-01	PM2 Centricleaner Bank	Cleaner	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
5	4	1	PM1-WIRE-01	PM1 Forming Fabric	Wire/Fabric	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
6	4	2	PM2-WIRE-01	PM2 Forming Fabric	Wire/Fabric	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
7	5	1	PM1-VAC-01	PM1 Vacuum Pump A	Vacuum Pump	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
8	5	2	PM2-VAC-01	PM2 Vacuum Pump A	Vacuum Pump	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
9	6	1	PM1-PRES-01	PM1 Press Roll	Press Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
10	6	2	PM2-PRES-01	PM2 Shoe Press	Press Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
11	7	1	PM1-UNI-01	PM1 Unirun Blow Box	Other	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
12	7	2	PM2-UNI-01	PM2 Unirun Blow Box	Other	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
13	8	1	PM1-DRY-01	PM1 Pre-Dryer Cylinders	Dryer Cylinder	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
14	8	2	PM2-DRY-01	PM2 Pre-Dryer Cylinders	Dryer Cylinder	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
15	9	1	PM1-SIZE-01	PM1 Size Press Roll	Press Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
16	9	2	PM2-SIZE-01	PM2 Size Press Roll	Press Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
17	10	1	KITCH-STARCH-01	PM1 Size Kitchen Cooker	Tank/Chest	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
18	10	2	KITCH-STARCH-02	PM2 Size Kitchen Cooker	Tank/Chest	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
19	11	1	PM1-PDRY-01	PM1 Post-Dryer Cylinders	Dryer Cylinder	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
20	11	2	PM2-PDRY-01	PM2 Post-Dryer Cylinders	Dryer Cylinder	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
21	12	1	PM1-CAL-01	PM1 Calender Nip	Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
22	12	2	PM2-CAL-01	PM2 Calender Nip	Roll	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
23	13	1	PM1-POPE-01	PM1 Pope Drum	Reel	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
24	13	2	PM2-POPE-01	PM2 Pope Drum	Reel	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
25	14	3	RW1-SLIT-01	Rewinder 1 Slitter Blades	Winder	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
26	14	4	CT1-KNIFE-01	Cutter 1 Rotary Knife	Other	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
27	15	\N	STARCH-COOK-01	Wet-End Starch Cooker	Tank/Chest	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
28	16	\N	STEAM-DIST-01	Dryer Steam Header	Other	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
29	17	\N	ETP-AER-01	ETP Aerator 1	Aerator	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
30	17	\N	ETP-PUMP-01	ETP Inlet Feed Pump	Pump	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
31	18	\N	BOILER-1	Rice Husk Boiler 1	Boiler	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
32	18	\N	BOILER-FWP	Boiler Feed Water Pump	Pump	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
33	19	\N	LAB-RHOM-01	Lab Rhometer Tester	Sensor	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
34	20	\N	CRANE-JUMBO	EOT Pope Reel Crane	Crane	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
35	21	\N	COMP-SCREW-01	Screw Compressor A	Compressor	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t	\N	2026-07-05 18:33:01.928881
36	\N	\N	STORE-SHELF-01	Store Inventory Racking	Other	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-05 18:33:01.928881
37	18	\N	BOILER-MAIN-01	Rice Husk Boiler	Boiler	\N	\N	\N	\N	\N	\N	\N	315.00	\N	t	t	\N	2026-07-06 01:39:29.873663
38	17	\N	ETP-AERATOR-02	Aeration Basin Aerator	Aerator	\N	\N	\N	\N	\N	\N	\N	110.00	\N	t	t	\N	2026-07-06 01:39:29.873663
39	19	\N	LAB-SCALE-01	Digital GSM Scale	Sensor	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-06 01:39:29.873663
40	20	\N	CRN-JUMBO-01	Overhead Jumbo Reel Crane	Crane	\N	\N	\N	\N	\N	\N	\N	90.00	\N	t	t	\N	2026-07-06 01:39:29.873663
41	16	\N	STEAM-PUMP-01	Condensate Return Pump	Pump	\N	\N	\N	\N	\N	\N	\N	45.00	\N	f	t	\N	2026-07-06 01:39:29.873663
42	15	\N	STARCH-MIX-01	Starch Cooking Agitator	Agitator	\N	\N	\N	\N	\N	\N	\N	37.00	\N	f	t	\N	2026-07-06 01:39:29.873663
43	85	\N	STORE-SCALE-01	Inventory Weigh Scale	Sensor	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2026-07-06 01:39:29.873663
\.


--
-- Data for Name: section_kpi_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_kpi_snapshots (id, section_id, snapshot_time, kpi_data, created_at) FROM stdin;
200	11	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.980787
201	12	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.982296
202	13	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.983779
203	14	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.985145
204	15	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.986465
205	16	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.987696
206	17	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.98893
207	18	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.990082
208	19	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.991267
209	20	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.99247
210	21	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.993559
232	1	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.037508
233	2	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.043035
234	3	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.04498
1	1	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.202559
2	2	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.208117
3	3	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.2098
4	4	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.211168
5	5	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.212429
6	6	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.213618
7	7	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.214805
8	8	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.215955
9	9	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.217151
10	10	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.219075
11	11	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.220684
12	12	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.221916
13	13	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.223027
14	14	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.224188
15	15	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.225361
16	16	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.22648
17	17	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.227651
18	18	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.228851
19	19	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.229996
20	20	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.231146
21	21	2026-06-30 11:00:00	{"_alarms": {}}	2026-06-30 11:28:17.232243
235	4	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.046782
190	1	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.947651
191	2	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.95918
192	3	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.964128
193	4	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.96728
194	5	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.969748
195	6	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.971836
196	7	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.973953
197	8	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.975644
198	9	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.977309
199	10	2026-06-30 12:00:00	{"_alarms": {}}	2026-06-30 12:04:04.97899
236	5	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.048545
237	6	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.05014
238	7	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.051695
239	8	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.052975
240	9	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.054561
241	10	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.056092
242	11	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.057486
243	12	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.058668
244	13	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.059978
245	14	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.061323
246	15	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.062607
247	16	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.063956
248	17	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.065206
249	18	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.068147
250	19	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.069636
251	20	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.071236
252	21	2026-06-30 13:00:00	{"_alarms": {}}	2026-06-30 13:52:45.072563
253	1	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.425333
254	2	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.432606
255	3	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.434652
256	4	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.436746
257	5	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.438713
258	6	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.440436
259	7	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.442361
260	8	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.44416
261	9	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.445893
262	10	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.447775
263	11	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.44954
264	12	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.452439
265	13	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.454133
266	14	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.45581
267	15	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.457513
268	16	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.459221
269	17	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.460854
270	18	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.462527
271	19	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.464665
272	20	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.466389
273	21	2026-06-30 15:00:00	{"_alarms": {}}	2026-06-30 15:29:22.467992
274	1	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.399584
275	2	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.412796
276	3	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.416008
277	4	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.419259
278	5	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.422489
279	6	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.425591
280	7	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.428644
281	8	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.431652
282	9	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.435667
283	10	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.438636
284	11	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.441461
285	12	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.444419
286	13	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.44751
287	14	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.450487
288	15	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.453399
289	16	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.456408
290	17	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.459274
291	18	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.462249
292	19	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.465172
293	20	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.468128
294	21	2026-06-30 16:00:00	{"_alarms": {}}	2026-06-30 16:29:22.471009
295	1	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.686131
296	2	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.771519
297	3	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.77866
298	4	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.793019
299	5	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.801081
300	6	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.802955
301	7	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.809079
302	8	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.813546
303	9	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.815939
304	10	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.821517
305	11	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.825567
306	12	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.829349
307	13	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.836831
308	14	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.842903
309	15	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.848459
310	16	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.855511
311	17	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.860134
312	18	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.863392
313	19	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.870043
314	20	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.872807
315	21	2026-06-30 17:00:00	{"_alarms": {}}	2026-06-30 17:31:21.878113
316	1	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.38133
317	2	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.384241
318	3	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.385095
319	4	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.385968
320	5	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.386773
321	6	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.387561
322	7	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.388366
323	8	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.38915
324	9	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.390031
325	10	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.390847
326	11	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.391604
327	12	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.392378
328	13	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.39304
329	14	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.393639
330	15	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.394221
331	16	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.394815
332	17	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.395535
333	18	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.396169
334	19	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.396765
335	20	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.39738
336	21	2026-06-30 18:00:00	{"_alarms": {}}	2026-06-30 18:31:21.398453
337	1	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.22595
338	2	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.236588
339	3	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.237957
340	4	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.239339
341	5	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.240956
342	6	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.243499
343	7	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.245065
344	8	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.246708
345	9	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.248159
346	10	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.249677
347	11	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.251028
348	12	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.252437
349	13	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.253832
350	14	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.255128
351	15	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.256493
352	16	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.257949
353	17	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.259264
354	18	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.260522
355	19	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.261764
356	20	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.264256
357	21	2026-06-30 20:00:00	{"_alarms": {}}	2026-06-30 20:43:44.265681
358	1	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.193612
359	2	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.202468
360	3	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.205061
361	4	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.208026
362	5	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.210251
363	6	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.212212
364	7	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.214104
365	8	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.21613
366	9	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.218208
367	10	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.220083
368	11	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.222068
369	12	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.224461
370	13	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.22681
371	14	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.228962
372	15	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.231766
373	16	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.234109
374	17	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.237057
375	18	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.240046
376	19	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.242184
377	20	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.244268
378	21	2026-06-30 21:00:00	{"_alarms": {}}	2026-06-30 21:43:44.246331
458	17	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.554656
459	18	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.556493
460	19	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.558126
461	20	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.559534
462	21	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.560755
515	11	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.453366
516	12	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.454352
517	13	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.455422
518	14	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.456513
519	15	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.457497
379	1	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.15534
380	2	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.158856
381	3	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.159874
382	4	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.160778
383	5	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.161776
384	6	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.162625
385	7	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.163523
386	8	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.164339
387	9	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.165081
388	10	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.165735
389	11	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.166366
390	12	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.16698
391	13	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.167591
392	14	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.168194
393	15	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.168795
394	16	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.16949
395	17	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.170101
396	18	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.170701
397	19	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.171325
398	20	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.171944
399	21	2026-06-30 22:00:00	{"_alarms": {}}	2026-06-30 22:43:44.172711
442	1	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.525614
443	2	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.529532
444	3	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.531492
445	4	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.533471
446	5	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.535289
447	6	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.53678
448	7	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.538215
449	8	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.539618
450	9	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.541017
451	10	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.542266
452	11	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.543549
453	12	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.544854
454	13	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.546411
455	14	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.548517
456	15	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.550843
457	16	2026-06-30 23:00:00	{"_alarms": {}}	2026-06-30 23:32:23.552707
520	16	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.458652
521	17	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.459684
505	1	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.436596
506	2	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.440601
507	3	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.4425
508	4	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.443884
509	5	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.445121
510	6	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.446185
511	7	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.448001
512	8	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.449363
513	9	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.451059
514	10	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.45227
522	18	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.460834
523	19	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.462124
524	20	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.463464
525	21	2026-07-01 00:00:00	{"_alarms": {}}	2026-07-01 00:02:15.465177
631	1	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.774304
632	2	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.829948
633	3	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.831972
634	4	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.83497
635	5	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.838368
636	6	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.840946
637	7	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.842906
638	8	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.845262
639	9	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.847251
640	10	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.849227
641	11	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.85151
642	12	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.853763
643	13	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.855796
644	14	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.859866
645	15	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.862114
646	16	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.864343
647	17	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.866284
648	18	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.868212
649	19	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.870249
650	20	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.872681
651	21	2026-07-01 06:00:00	{"_alarms": {}}	2026-07-01 06:02:06.874924
652	1	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.369671
653	2	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.378287
654	3	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.381099
655	4	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.383805
656	5	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.386577
657	6	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.389339
658	7	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.392083
659	8	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.394606
660	9	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.397201
661	10	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.399739
662	11	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.402297
663	12	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.404797
664	13	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.407421
665	14	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.410692
666	15	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.413302
667	16	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.415911
668	17	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.418446
669	18	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.421083
670	19	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.42374
671	20	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.427925
672	21	2026-07-01 07:00:00	{"_alarms": {}}	2026-07-01 07:02:05.430474
673	1	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.746468
674	2	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.759282
675	3	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.761737
676	4	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.764381
677	5	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.766522
678	6	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.768975
679	7	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.771194
680	8	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.77315
681	9	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.775657
682	10	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.777978
683	11	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.780091
684	12	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.785285
685	13	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.787653
686	14	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.789667
687	15	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.791716
688	16	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.794721
689	17	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.797183
690	18	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.799416
691	19	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.801562
692	20	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.803828
693	21	2026-07-01 08:00:00	{"_alarms": {}}	2026-07-01 08:21:16.805805
694	1	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.213623
695	2	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.379685
696	3	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.382029
697	4	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.384986
698	5	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.387706
699	6	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.390191
700	7	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.397149
701	8	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.402106
702	9	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.40435
703	10	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.406522
704	11	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.409457
705	12	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.41222
706	13	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.416544
707	14	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.42448
708	15	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.431602
709	16	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.438157
710	17	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.448349
711	18	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.461155
712	19	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.464152
713	20	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.465901
714	21	2026-07-01 18:00:00	{"_alarms": {}}	2026-07-01 18:36:06.469365
715	1	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.355936
716	2	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.36717
717	3	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.368328
718	4	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.369358
719	5	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.370907
720	6	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.372665
721	7	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.374481
722	8	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.375702
723	9	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.376856
724	10	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.377851
725	11	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.379668
726	12	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.380725
727	13	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.381941
728	14	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.382947
729	15	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.383921
730	16	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.385064
731	17	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.386177
732	18	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.388088
733	19	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.390743
734	20	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.392335
735	21	2026-07-01 19:00:00	{"_alarms": {}}	2026-07-01 19:36:04.393706
736	1	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.802597
737	2	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.816555
738	3	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.818275
739	4	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.819772
740	5	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.822204
741	6	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.824655
742	7	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.826265
743	8	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.835851
744	9	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.837121
745	10	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.838439
746	11	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.839762
747	12	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.859945
748	13	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.861643
749	14	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.863174
750	15	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.864705
751	16	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.865995
752	17	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.867517
753	18	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.868857
754	19	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.870297
755	20	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.871412
756	21	2026-07-01 20:00:00	{"_alarms": {}}	2026-07-01 20:44:28.872595
757	1	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.163573
758	2	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.171249
759	3	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.173653
760	4	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.177156
761	5	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.179041
762	6	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.181277
763	7	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.185709
764	8	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.188526
765	9	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.191623
766	10	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.193329
767	11	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.195297
768	12	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.197982
769	13	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.19975
770	14	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.202544
771	15	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.204383
772	16	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.20637
773	17	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.208559
774	18	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.210754
775	19	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.212502
776	20	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.214102
777	21	2026-07-01 22:00:00	{"_alarms": {}}	2026-07-01 22:19:12.215734
778	1	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.802487
779	2	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.807226
780	3	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.808996
781	4	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.8108
782	5	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.81242
783	6	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.813926
784	7	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.815518
785	8	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.817252
786	9	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.820279
787	10	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.822935
788	11	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.824594
789	12	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.825971
790	13	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.827351
791	14	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.828555
792	15	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.829955
793	16	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.831355
794	17	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.832885
795	18	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.834433
796	19	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.835704
797	20	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.837375
798	21	2026-07-01 23:00:00	{"_alarms": {}}	2026-07-01 23:19:11.839154
799	1	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.824794
800	2	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.860605
801	3	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.863581
802	4	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.865694
803	5	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.867523
804	6	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.869389
805	7	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.871249
806	8	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.873138
807	9	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.921884
808	10	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.923485
809	11	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.925241
810	12	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.927618
811	13	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.930138
812	14	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.931839
813	15	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.933249
814	16	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.934744
815	17	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.936171
816	18	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.93782
817	19	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.939407
818	20	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.94119
819	21	2026-07-02 18:00:00	{"_alarms": {}}	2026-07-02 18:27:41.94297
824	5	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.107431
825	6	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.108672
827	8	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.111592
828	9	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.112696
829	10	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.113794
830	11	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.114899
831	12	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.115961
832	13	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.117256
833	14	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.118551
834	15	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.119678
835	16	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.120723
836	17	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.121833
821	2	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.1033
822	3	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.104972
823	4	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.106262
971	5	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.338455
972	6	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.343053
973	7	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.347319
974	8	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.352254
975	9	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.356298
976	10	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.360675
977	11	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.364749
978	12	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.368563
979	13	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.372534
980	14	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.37728
981	15	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.381259
982	16	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.38531
983	17	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.389437
984	18	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.393859
985	19	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.397816
1116	3	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.384208
820	1	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.089596
826	7	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.109851
837	18	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.122953
838	19	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.124225
839	20	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.125353
840	21	2026-07-05 14:00:00	{"_alarms": {}}	2026-07-05 14:11:58.126484
925	1	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.356387
926	2	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.364732
927	3	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.36674
928	4	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.368682
929	5	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.370736
930	6	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.376585
931	7	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.378695
932	8	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.380752
933	9	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.382575
934	10	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.384727
935	11	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.387817
936	12	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.390949
937	13	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.392733
938	14	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.394479
939	15	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.396466
940	16	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.398406
941	17	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.400351
942	18	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.402152
943	19	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.403983
944	20	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.410266
945	21	2026-07-05 15:00:00	{"_alarms": {}}	2026-07-05 15:51:41.412727
946	1	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.476264
947	2	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.481891
948	3	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.484305
949	4	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.486197
950	5	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.488567
951	6	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.490297
952	7	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.492012
953	8	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.493676
954	9	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.49526
955	10	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.496842
956	11	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.498307
957	12	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.499814
958	13	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.50151
959	14	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.503197
960	15	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.50551
961	16	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.507661
962	17	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.509163
963	18	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.510671
964	19	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.512136
965	20	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.513918
966	21	2026-07-05 16:00:00	{"_alarms": {}}	2026-07-05 16:32:01.515514
1117	4	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.385508
1118	5	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.38692
1119	6	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.388104
1120	7	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.389156
1121	8	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.390323
1114	1	2026-07-05 18:00:00	{"_alarms": {}, "WIRE-VAC-P1": {"avg": 2.8, "uom": "kPa", "param": "Wire Vacuum P1"}}	2026-07-05 18:33:17.379368
967	1	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.306604
968	2	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.324417
986	20	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.401728
987	21	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.405416
1115	2	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.382734
1122	9	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.391453
969	3	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.330044
970	4	2026-07-05 17:00:00	{"_alarms": {}}	2026-07-05 17:27:27.334233
1503	12	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.128582
1504	13	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.129769
1492	1	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.111094
1493	2	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.114938
1494	3	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.116666
1495	4	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.118265
1496	5	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.11956
1497	6	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.120821
1498	7	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.122055
1499	8	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.123285
1123	10	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.392545
1124	11	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.394336
1125	12	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.39537
1126	13	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.396373
1127	14	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.397557
1128	15	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.398665
1129	20	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.399666
1130	16	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.400639
1131	17	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.401675
1132	18	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.402662
1133	21	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.403644
1134	19	2026-07-05 18:00:00	{"_alarms": {}}	2026-07-05 18:33:17.404554
1450	1	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:46.93251
1451	2	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.152462
1452	3	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.176769
1453	4	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.181976
1454	5	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.184987
1455	6	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.190774
1456	7	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.208731
1457	8	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.229169
1458	9	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.283555
1459	10	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.288439
1460	11	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.291042
1461	12	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.294465
1462	13	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.296696
1463	14	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.300614
1464	15	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.303319
1465	20	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.306471
1466	16	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.308471
1467	17	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.311005
1468	18	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.313126
1469	21	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.316281
1470	19	2026-07-05 19:00:00	{"_alarms": {}}	2026-07-05 19:58:50.322221
1471	1	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:22.151311
1472	2	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.703072
1473	3	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.710235
1474	4	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.713997
1475	5	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.718331
1476	6	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.720325
1477	7	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.723428
1478	8	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.729068
1479	9	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.735191
1480	10	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.738226
1481	11	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.742358
1482	12	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.749764
1483	13	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.753158
1500	9	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.124476
1484	14	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.756699
1485	15	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.761504
1486	20	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.764757
1487	16	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.768376
1488	17	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.771253
1489	18	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.774461
1490	21	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.776218
1491	19	2026-07-05 21:00:00	{"_alarms": {}}	2026-07-05 21:35:24.778637
1501	10	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.125649
1502	11	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.127285
1823	16	2026-07-06 01:00:00	{"_alarms": {}, "STEAM-PUMP-01": {"avg": 1, "uom": "ON/OFF", "param": "Condensate Return Pump Status"}}	2026-07-06 01:06:30.405733
1824	17	2026-07-06 01:00:00	{"_alarms": {}, "ETP-AERATOR-02": {"avg": 1, "uom": "ON/OFF", "param": "Aeration Basin Aerator Status"}}	2026-07-06 01:06:30.408535
1825	18	2026-07-06 01:00:00	{"_alarms": {}, "BOILER-MAIN-01": {"avg": 1, "uom": "ON/OFF", "param": "Rice Husk Boiler Status"}}	2026-07-06 01:06:30.410572
1826	21	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.412437
1827	19	2026-07-06 01:00:00	{"_alarms": {}, "LAB-SCALE-01": {"avg": 1, "uom": "ON/OFF", "param": "Digital GSM Scale Status"}}	2026-07-06 01:06:30.414321
2080	85	2026-07-06 01:00:00	{"_alarms": {}, "STORE-SCALE-01": {"avg": 1, "uom": "ON/OFF", "param": "Inventory Weigh Scale Status"}}	2026-07-06 01:37:46.055666
2345	1	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.918442
2346	2	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.923891
2347	3	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.926244
2348	4	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.928155
2349	5	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.929786
2350	6	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.931452
2351	7	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.933111
2352	8	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.934932
2353	9	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.936439
2354	10	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.937947
2355	11	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.939601
2356	12	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.941321
2357	13	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.943075
2358	14	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.945605
2359	15	2026-07-06 02:00:00	{"_alarms": {}, "STARCH-MIX-01": {"avg": 1, "uom": "ON/OFF", "param": "Starch Cooking Agitator Status"}}	2026-07-06 02:03:01.947481
2360	20	2026-07-06 02:00:00	{"_alarms": {}, "CRN-JUMBO-01": {"avg": 1, "uom": "ON/OFF", "param": "Overhead Jumbo Reel Crane Status"}}	2026-07-06 02:03:01.949266
2361	16	2026-07-06 02:00:00	{"_alarms": {}, "STEAM-PUMP-01": {"avg": 1, "uom": "ON/OFF", "param": "Condensate Return Pump Status"}}	2026-07-06 02:03:01.951149
2362	17	2026-07-06 02:00:00	{"_alarms": {}, "ETP-AERATOR-02": {"avg": 1, "uom": "ON/OFF", "param": "Aeration Basin Aerator Status"}}	2026-07-06 02:03:01.952718
1505	14	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.131603
1506	15	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.13322
1507	20	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.135078
1508	16	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.136416
1509	17	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.138051
1510	18	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.139364
1511	21	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.140601
1512	19	2026-07-06 00:00:00	{"_alarms": {}}	2026-07-06 00:08:21.141808
2363	18	2026-07-06 02:00:00	{"_alarms": {}, "BOILER-MAIN-01": {"avg": 1, "uom": "ON/OFF", "param": "Rice Husk Boiler Status"}}	2026-07-06 02:03:01.95454
2364	21	2026-07-06 02:00:00	{"_alarms": {}}	2026-07-06 02:03:01.956153
1807	1	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.356511
1808	2	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.374966
1809	3	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.377554
1810	4	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.379756
2365	19	2026-07-06 02:00:00	{"_alarms": {}, "LAB-SCALE-01": {"avg": 1, "uom": "ON/OFF", "param": "Digital GSM Scale Status"}}	2026-07-06 02:03:01.957806
2366	85	2026-07-06 02:00:00	{"_alarms": {}, "STORE-SCALE-01": {"avg": 1, "uom": "ON/OFF", "param": "Inventory Weigh Scale Status"}}	2026-07-06 02:03:01.959357
2367	1	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.532845
2368	2	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.546103
2369	3	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.548242
2370	4	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.549494
2371	5	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.551051
2372	6	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.552285
2373	7	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.553433
2374	8	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.554453
2375	9	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.555704
2376	10	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.556707
1811	5	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.381769
1812	6	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.3836
1813	7	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.385532
1814	8	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.38821
1815	9	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.390242
1816	10	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.392214
1817	11	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.394196
1818	12	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.396148
1819	13	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.398018
1820	14	2026-07-06 01:00:00	{"_alarms": {}}	2026-07-06 01:06:30.399947
1821	15	2026-07-06 01:00:00	{"_alarms": {}, "STARCH-MIX-01": {"avg": 1, "uom": "ON/OFF", "param": "Starch Cooking Agitator Status"}}	2026-07-06 01:06:30.401748
1822	20	2026-07-06 01:00:00	{"_alarms": {}, "CRN-JUMBO-01": {"avg": 1, "uom": "ON/OFF", "param": "Overhead Jumbo Reel Crane Status"}}	2026-07-06 01:06:30.403616
2377	11	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.557704
2378	12	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.558647
2379	13	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.559589
2380	14	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.560655
2381	15	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.562356
2382	20	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.563475
2383	16	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.564718
2384	17	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.565757
2385	18	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.566861
2386	21	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.569054
2387	19	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.570346
2388	85	2026-07-06 11:00:00	{"_alarms": {}}	2026-07-06 11:27:45.571287
2389	1	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.534984
2390	2	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.550668
2391	3	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.551976
2392	4	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.553
2393	5	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.554876
2394	6	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.55565
2395	7	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.559864
2396	8	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.561269
2397	9	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.562243
2398	10	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.564797
2399	11	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.567324
2400	12	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.568183
2401	13	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.56903
2402	14	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.569837
2403	15	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.570591
2404	20	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.571291
2405	16	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.571931
2406	17	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.573099
2407	18	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.57402
2408	21	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.574882
2409	19	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.575676
2410	85	2026-07-06 12:00:00	{"_alarms": {}}	2026-07-06 12:27:40.576357
2411	1	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.128166
2412	2	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.150643
2413	3	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.152315
2414	4	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.153891
2415	5	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.155413
2416	6	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.156907
2417	7	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.158317
2418	8	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.159826
2419	9	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.162257
2420	10	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.164619
2421	11	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.166043
2422	12	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.167324
2423	13	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.168679
2424	14	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.170831
2425	15	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.172348
2426	20	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.174641
2427	16	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.176396
2428	17	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.18021
2429	18	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.1904
2430	21	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.192326
2431	19	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.193846
2432	85	2026-07-06 13:00:00	{"_alarms": {}}	2026-07-06 13:29:21.195583
2433	1	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.549732
2434	2	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.569788
2435	3	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.571632
2436	4	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.57334
2437	5	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.575473
2438	6	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.577185
2439	7	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.578797
2440	8	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.580596
2441	9	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.582773
2442	10	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.584945
2443	11	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.586745
2444	12	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.588166
2445	13	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.589491
2446	14	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.598303
2447	15	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.599982
2448	20	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.601424
2449	16	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.602951
2450	17	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.604437
2451	18	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.606056
2452	21	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.607578
2453	19	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.609078
2454	85	2026-07-06 14:00:00	{"_alarms": {}}	2026-07-06 14:34:05.61065
2455	1	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.358285
2456	2	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.36289
2457	3	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.363962
2458	4	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.364899
2459	5	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.366094
2460	6	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.367172
2461	7	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.369387
2462	8	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.370562
2463	9	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.371506
2464	10	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.373165
2465	11	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.374199
2466	12	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.375135
2467	13	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.376146
2468	14	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.378414
2469	15	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.379622
2470	20	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.38082
2471	16	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.382171
2472	17	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.383727
2473	18	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.385291
2474	21	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.387718
2475	19	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.388879
2476	85	2026-07-06 15:00:00	{"_alarms": {}}	2026-07-06 15:34:05.389857
2477	1	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.370272
2478	2	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.374412
2479	3	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.375983
2480	4	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.377392
2481	5	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.378746
2482	6	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.380772
2483	7	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.382347
2484	8	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.384123
2485	9	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.385723
2486	10	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.387985
2487	11	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.389263
2488	12	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.390289
2489	13	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.391275
2490	14	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.392987
2491	15	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.394266
2492	20	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.395307
2493	16	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.396622
2494	17	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.397663
2495	18	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.398745
2496	21	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.400081
2497	19	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.401649
2498	85	2026-07-06 16:00:00	{"_alarms": {}}	2026-07-06 16:34:05.403283
2499	1	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.444144
2500	2	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.455058
2501	3	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.458797
2502	4	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.462636
2503	5	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.466533
2504	6	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.470352
2505	7	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.473815
2506	8	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.477852
2507	9	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.481087
2508	10	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.484464
2509	11	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.487616
2510	12	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.490853
2511	13	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.493952
2512	14	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.497325
2513	15	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.500521
2514	20	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.503646
2515	16	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.506709
2516	17	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.509973
2517	18	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.513859
2518	21	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.516994
2519	19	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.52045
2520	85	2026-07-06 17:00:00	{"_alarms": {}}	2026-07-06 17:34:05.524468
2521	1	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.465338
2522	2	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.477496
2523	3	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.482735
2524	4	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.486731
2525	5	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.490748
2526	6	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.495244
2527	7	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.499195
2528	8	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.504482
2529	9	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.508058
2530	10	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.511804
2531	11	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.516002
2532	12	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.519623
2533	13	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.52343
2534	14	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.528242
2535	15	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.532457
2536	20	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.536235
2537	16	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.539842
2538	17	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.543763
2539	18	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.548248
2540	21	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.552467
2541	19	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.55595
2542	85	2026-07-06 18:00:00	{"_alarms": {}}	2026-07-06 18:34:05.560979
2543	1	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.804275
2544	2	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.817129
2545	3	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.818588
2546	4	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.819997
2547	5	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.821679
2548	6	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.823799
2549	7	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.824998
2550	8	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.826099
2551	9	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.827101
2552	10	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.828146
2553	11	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.829126
2554	12	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.830137
2555	13	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.831639
2556	14	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.832642
2557	15	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.833579
2558	20	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.834509
2559	16	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.835466
2560	17	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.836441
2561	18	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.837691
2562	21	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.839605
2563	19	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.841483
2564	85	2026-07-07 09:00:00	{"_alarms": {}}	2026-07-07 09:32:23.84266
2565	1	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.604941
2566	2	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.780258
2567	3	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.782153
2568	4	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.78763
2569	5	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.790729
2570	6	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.792839
2571	7	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.795701
2572	8	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.802761
2573	9	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.805152
2574	10	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.808478
2575	11	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.811341
2576	12	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.814477
2577	13	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.815769
2578	14	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.817667
2579	15	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.81888
2580	20	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.819995
2581	16	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.82119
2582	17	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.822538
2583	18	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.823984
2584	21	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.825273
2585	19	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.826088
2586	85	2026-07-07 10:00:00	{"_alarms": {}}	2026-07-07 10:34:28.82693
2587	1	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.597047
2588	2	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.600396
2589	3	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.601444
2590	4	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.60238
2591	5	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.603287
2592	6	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.604178
2593	7	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.605059
2594	8	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.606465
2595	9	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.607257
2596	10	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.608072
2597	11	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.608956
2598	12	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.610055
2599	13	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.61125
2600	14	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.612369
2601	15	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.613256
2602	20	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.614619
2603	16	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.615435
2604	17	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.617201
2605	18	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.617921
2606	21	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.61858
2607	19	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.619199
2608	85	2026-07-07 11:00:00	{"_alarms": {}}	2026-07-07 11:34:28.619853
2609	1	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.590157
2610	2	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.593586
2611	3	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.594626
2612	4	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.595692
2613	5	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.59671
2614	6	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.597673
2615	7	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.598623
2616	8	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.600163
2617	9	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.600992
2618	10	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.602024
2619	11	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.60388
2620	12	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.605239
2621	13	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.606065
2622	14	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.606915
2623	15	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.607681
2624	20	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.608404
2625	16	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.609643
2626	17	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.610327
2627	18	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.61108
2628	21	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.612101
2629	19	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.612883
2630	85	2026-07-07 12:00:00	{"_alarms": {}}	2026-07-07 12:34:28.613586
2631	1	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.618
2632	2	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.630517
2633	3	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.631624
2634	4	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.632591
2635	5	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.633544
2636	6	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.634479
2637	7	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.635361
2638	8	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.636227
2639	9	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.637109
2640	10	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.637938
2641	11	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.638765
2642	12	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.639508
2643	13	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.64051
2644	14	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.641992
2645	15	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.642768
2646	20	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.643449
2647	16	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.64411
2648	17	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.644726
2649	18	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.645358
2650	21	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.645964
2651	19	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.646639
2652	85	2026-07-07 13:00:00	{"_alarms": {}}	2026-07-07 13:34:28.647355
2653	1	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.715855
2654	2	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.720743
2655	3	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.721929
2656	4	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.722902
2657	5	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.723863
2658	6	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.724775
2659	7	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.725634
2660	8	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.727356
2661	9	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.728601
2662	10	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.729521
2663	11	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.730431
2664	12	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.731309
2665	13	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.732368
2666	14	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.733252
2667	15	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.734137
2668	20	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.734966
2669	16	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.737122
2670	17	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.73848
2671	18	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.739386
2672	21	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.740302
2673	19	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.741437
2674	85	2026-07-07 14:00:00	{"_alarms": {}}	2026-07-07 14:34:28.742773
2675	1	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.711403
2676	2	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.72435
2677	3	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.728183
2678	4	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.732406
2679	5	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.736123
2680	6	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.739795
2681	7	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.743619
2682	8	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.748431
2683	9	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.75211
2684	10	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.755746
2685	11	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.759185
2686	12	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.762704
2687	13	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.766532
2688	14	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.770084
2689	15	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.773404
2690	20	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.776592
2691	16	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.780486
2692	17	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.783914
2693	18	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.788538
2694	21	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.791863
2695	19	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.795351
2696	85	2026-07-07 15:00:00	{"_alarms": {}}	2026-07-07 15:34:28.79915
2697	1	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.70384
2698	2	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.713639
2699	3	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.716713
2700	4	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.719722
2701	5	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.7227
2702	6	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.725473
2703	7	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.72879
2704	8	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.732184
2705	9	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.735114
2706	10	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.737919
2707	11	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.740782
2708	12	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.743731
2709	13	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.746535
2710	14	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.74934
2711	15	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.752066
2712	20	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.755102
2713	16	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.757734
2714	17	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.760195
2715	18	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.763753
2716	21	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.766746
2717	19	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.769381
2718	85	2026-07-07 16:00:00	{"_alarms": {}}	2026-07-07 16:34:28.771864
2719	1	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.755617
2720	2	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.771426
2721	3	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.776541
2722	4	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.780649
2723	5	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.78622
2724	6	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.790814
2725	7	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.795258
2726	8	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.800217
2727	9	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.804938
2728	10	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.808846
2729	11	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.812416
2730	12	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.816436
2731	13	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.820407
2732	14	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.824054
2733	15	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.827466
2734	20	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.83104
2735	16	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.838657
2736	17	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.842814
2737	18	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.846808
2738	21	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.851705
2739	19	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.856005
2740	85	2026-07-07 17:00:00	{"_alarms": {}}	2026-07-07 17:34:28.859981
2741	1	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.673012
2742	2	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.676765
2743	3	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.678174
2744	4	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.681153
2745	5	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.682643
2746	6	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.683897
2747	7	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.685338
2748	8	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.686756
2749	9	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.687837
2750	10	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.689518
2751	11	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.69047
2752	12	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.691462
2753	13	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.692514
2754	14	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.693641
2755	15	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.695264
2756	20	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.697312
2757	16	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.698553
2758	17	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.699907
2759	18	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.700897
2760	21	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.702931
2761	19	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.704116
2762	85	2026-07-07 18:00:00	{"_alarms": {}}	2026-07-07 18:34:28.705188
2763	1	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.701699
2764	2	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.704485
2765	3	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.705416
2766	4	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.706321
2767	5	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.707292
2768	6	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.708211
2769	7	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.709072
2770	8	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.710147
2771	9	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.710953
2772	10	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.712059
2773	11	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.713231
2774	12	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.714389
2775	13	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.715612
2776	14	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.717142
2777	15	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.718028
2778	20	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.718915
2779	16	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.71984
2780	17	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.720678
2781	18	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.721475
2782	21	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.722332
2783	19	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.723374
2784	85	2026-07-07 19:00:00	{"_alarms": {}}	2026-07-07 19:34:28.724218
2785	1	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:16.256307
2786	2	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.86284
2787	3	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.867587
2788	4	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.87258
2789	5	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.876974
2790	6	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.881665
2791	7	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.884027
2792	8	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.887519
2793	9	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.889752
2794	10	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.892487
2795	11	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.89872
2796	12	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.900779
2797	13	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.902561
2798	14	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.904434
2799	15	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.907049
2800	20	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.909477
2801	16	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.911467
2802	17	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.913795
2803	18	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.922903
2804	21	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.925152
2805	19	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.927652
2806	85	2026-07-07 20:00:00	{"_alarms": {}}	2026-07-07 20:36:18.929706
2807	1	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.916214
2808	2	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.926764
2809	3	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.930833
2810	4	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.934847
2811	5	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.939264
2812	6	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.94333
2813	7	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.947758
2814	8	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.951337
2815	9	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.954932
2816	10	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.958857
2817	11	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.96305
2818	12	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.966447
2819	13	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.969848
2820	14	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.97375
2821	15	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.978706
2822	20	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.982022
2823	16	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.985608
2824	17	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.990521
2825	18	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.994263
2826	21	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:15.99752
2827	19	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:16.000886
2828	85	2026-07-07 21:00:00	{"_alarms": {}}	2026-07-07 21:36:16.00493
2829	1	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.837502
2830	2	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.840633
2831	3	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.841551
2832	4	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.842668
2833	5	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.843768
2834	6	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.844682
2835	7	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.845628
2836	8	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.846531
2837	9	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.847403
2838	10	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.848191
2839	11	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.849857
2840	12	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.850762
2841	13	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.851669
2842	14	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.852604
2843	15	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.853387
2844	20	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.85419
2845	16	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.854975
2846	17	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.855685
2847	18	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.856847
2848	21	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.857526
2849	19	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.858131
2850	85	2026-07-07 22:00:00	{"_alarms": {}}	2026-07-07 22:36:15.859236
2851	1	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.850707
2852	2	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.854036
2853	3	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.855179
2854	4	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.856071
2855	5	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.856998
2856	6	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.857855
2857	7	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.858947
2858	8	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.860586
2859	9	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.861418
2860	10	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.862236
2861	11	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.863065
2862	12	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.864366
2863	13	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.865856
2864	14	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.866722
2865	15	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.867555
2866	20	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.868359
2867	16	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.870965
2868	17	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.871712
2869	18	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.872491
2870	21	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.873113
2871	19	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.873799
2872	85	2026-07-07 23:00:00	{"_alarms": {}}	2026-07-07 23:36:15.874654
2873	1	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.862557
2874	2	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.866216
2875	3	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.867145
2876	4	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.867969
2877	5	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.868788
2878	6	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.870013
2879	7	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.871012
2880	8	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.872097
2881	9	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.873044
2882	10	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.873955
2883	11	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.874837
2884	12	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.8757
2885	13	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.876534
2886	14	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.878016
2887	15	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.879725
2888	20	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.880771
2889	16	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.881645
2890	17	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.882397
2891	18	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.883119
2892	21	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.883808
2893	19	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.884481
2894	85	2026-07-08 00:00:00	{"_alarms": {}}	2026-07-08 00:36:15.88511
2895	1	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.860447
2896	2	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.87911
2897	3	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.88054
2898	4	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.882556
2899	5	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.883619
2900	6	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.884653
2901	7	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.885745
2902	8	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.886854
2903	9	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.887927
2904	10	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.888885
2905	11	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.890767
2906	12	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.891779
2907	13	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.892749
2908	14	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.894373
2909	15	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.895527
2910	20	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.896563
2911	16	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.897598
2912	17	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.898607
2913	18	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.900448
2914	21	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.901544
2915	19	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.902663
2916	85	2026-07-08 12:00:00	{"_alarms": {}}	2026-07-08 12:34:39.90345
2939	1	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.389318
2940	2	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.399042
2941	3	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.400137
2942	4	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.401182
2943	5	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.402184
2944	6	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.403159
2945	7	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.4042
2946	8	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.405752
2947	9	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.4066
2948	10	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.407496
2949	11	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.408292
2950	12	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.409094
2951	13	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.409805
2952	14	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.410469
2953	15	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.411092
2954	20	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.411823
2955	16	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.413319
2956	17	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.41441
2957	18	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.415686
2958	21	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.416645
2959	19	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.41763
2960	85	2026-07-08 13:00:00	{"_alarms": {}}	2026-07-08 13:47:43.418598
2961	1	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.422487
2962	2	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.427924
2963	3	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.428917
2964	4	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.430277
2965	5	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.431869
2966	6	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.432824
2967	7	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.43378
2968	8	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.435012
2969	9	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.43601
2970	10	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.437039
2971	11	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.438634
2972	12	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.439635
2973	13	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.440569
2974	14	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.441399
2975	15	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.442408
2976	20	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.44333
2977	16	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.44433
2978	17	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.445194
2979	18	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.446928
2980	21	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.447762
2981	19	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.44859
2982	85	2026-07-08 14:00:00	{"_alarms": {}}	2026-07-08 14:47:43.449422
2983	1	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.664248
2984	2	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.668182
2985	3	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.66958
2986	4	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.671163
2987	5	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.672545
2988	6	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.673842
2989	7	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.67539
2990	8	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.676793
2991	9	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.678358
2992	10	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.679951
2993	11	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.681573
2994	12	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.68301
2995	13	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.684509
2996	14	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.685979
2997	15	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.687431
2998	20	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.688979
2999	16	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.69083
3000	17	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.692324
3001	18	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.694012
3002	21	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.695524
3003	19	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.696861
3004	85	2026-07-08 16:00:00	{"_alarms": {}}	2026-07-08 16:19:09.697975
3005	1	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.604434
3006	2	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.608755
3007	3	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.610043
3008	4	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.61109
3009	5	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.612011
3010	6	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.612938
3011	7	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.613851
3012	8	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.61526
3013	9	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.616135
3014	10	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.616965
3015	11	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.61777
3016	12	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.618427
3017	13	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.619154
3018	14	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.620561
3019	15	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.621483
3020	20	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.622273
3021	16	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.623049
3022	17	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.623923
3023	18	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.625104
3024	21	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.626136
3025	19	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.627094
3026	85	2026-07-08 17:00:00	{"_alarms": {}}	2026-07-08 17:19:09.627912
3027	1	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.583672
3028	2	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.587057
3029	3	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.588321
3030	4	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.589634
3031	5	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.590687
3032	6	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.592386
3033	7	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.593345
3034	8	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.594265
3035	9	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.595338
3036	10	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.596562
3037	11	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.597604
3038	12	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.598484
3039	13	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.599338
3040	14	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.600822
3041	15	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.601669
3042	20	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.602472
3043	16	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.60347
3044	17	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.604747
3045	18	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.605782
3046	21	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.606783
3047	19	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.607721
3048	85	2026-07-08 18:00:00	{"_alarms": {}}	2026-07-08 18:19:09.609425
3049	1	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.619193
3050	2	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.621693
3051	3	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.62255
3052	4	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.623392
3053	5	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.624257
3054	6	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.625085
3055	7	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.625913
3056	8	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.626614
3057	9	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.627234
3058	10	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.62783
3059	11	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.62845
3060	12	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.629044
3061	13	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.629845
3062	14	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.631012
3063	15	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.6316
3064	20	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.632199
3065	16	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.632855
3066	17	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.633504
3067	18	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.63462
3068	21	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.63599
3069	19	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.636768
3070	85	2026-07-08 19:00:00	{"_alarms": {}}	2026-07-08 19:19:09.637453
3071	1	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.744177
3072	2	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.746921
3073	3	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.747919
3074	4	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.749001
3075	5	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.749859
3076	6	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.750737
3077	7	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.751801
3078	8	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.752483
3079	9	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.753149
3080	10	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.753786
3081	11	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.754555
3082	12	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.755234
3083	13	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.755926
3084	14	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.756994
3085	15	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.757641
3086	20	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.758344
3087	16	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.759015
3088	17	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.760136
3089	18	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.760864
3090	21	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.762451
3091	19	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.7648
3092	85	2026-07-08 20:00:00	{"_alarms": {}}	2026-07-08 20:19:09.765878
3093	1	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.655511
3094	2	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.6631
3095	3	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.665931
3096	4	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.668709
3097	5	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.671595
3098	6	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.674423
3099	7	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.677008
3100	8	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.680534
3101	9	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.683271
3102	10	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.685992
3103	11	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.688665
3104	12	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.691637
3105	13	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.69432
3106	14	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.697111
3107	15	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.699609
3108	20	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.703097
3109	16	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.705742
3110	17	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.708526
3111	18	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.711188
3112	21	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.714333
3113	19	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.717078
3114	85	2026-07-08 21:00:00	{"_alarms": {}}	2026-07-08 21:19:09.720033
3115	1	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.637533
3116	2	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.642727
3117	3	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.645989
3118	4	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.647453
3119	5	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.648833
3120	6	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.650325
3121	7	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.651651
3122	8	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.65292
3123	9	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.654127
3124	10	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.655404
3125	11	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.658489
3126	12	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.659695
3127	13	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.66106
3128	14	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.662357
3129	15	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.663735
3130	20	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.664975
3131	16	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.666799
3132	17	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.66813
3133	18	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.669544
3134	21	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.670947
3135	19	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.672458
3136	85	2026-07-08 22:00:00	{"_alarms": {}}	2026-07-08 22:23:36.6739
3137	1	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.433215
3138	2	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.440126
3139	3	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.442087
3140	4	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.445372
3141	5	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.448232
3142	6	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.450106
3143	7	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.452207
3144	8	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.457619
3145	9	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.459288
3146	10	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.462024
3147	11	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.464877
3148	12	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.466446
3149	13	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.46877
3150	14	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.471857
3151	15	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.473667
3152	20	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.484403
3153	16	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.48586
3154	17	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.488602
3155	18	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.490235
3156	21	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.492584
3157	19	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.493964
3158	85	2026-07-09 01:00:00	{"_alarms": {}}	2026-07-09 01:03:10.496765
3159	1	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.870216
3160	2	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.884465
3161	3	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.891368
3162	4	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.897013
3163	5	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.902628
3164	6	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.907333
3165	7	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.911816
3166	8	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.91618
3167	9	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.920944
3168	10	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.925276
3169	11	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.930788
3170	12	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.935212
3171	13	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.939943
3172	14	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.944744
3173	15	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.949047
3174	20	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.953558
3175	16	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.957974
3176	17	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.962742
3177	18	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.96848
3178	21	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.973077
3179	19	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.977442
3180	85	2026-07-09 08:00:00	{"_alarms": {}}	2026-07-09 08:19:20.981497
3203	1	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.344588
3204	2	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.349732
3205	3	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.351429
3206	4	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.353766
3207	5	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.355512
3208	6	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.357901
3209	7	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.361321
3210	8	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.366721
3211	9	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.373409
3212	10	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.379903
3213	11	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.38161
3214	12	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.383288
3215	13	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.385135
3216	14	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.389077
3217	15	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.390636
3218	20	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.392457
3219	16	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.393945
3220	17	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.401835
3221	18	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.408593
3222	21	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.410586
3223	19	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.413961
3224	85	2026-07-09 09:00:00	{"_alarms": {}}	2026-07-09 09:46:11.415533
3225	1	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:26.473274
3226	2	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.105878
3227	3	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.108102
3228	4	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.110169
3229	5	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.11562
3230	6	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.117435
3231	7	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.1192
3232	8	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.121066
3233	9	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.12313
3234	10	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.124934
3235	11	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.139113
3236	12	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.141896
3237	13	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.143798
3238	14	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.146589
3239	15	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.148816
3240	20	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.150744
3241	16	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.153281
3242	17	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.155464
3243	18	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.158468
3244	21	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.162483
3245	19	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.167772
3246	85	2026-07-09 14:00:00	{"_alarms": {}}	2026-07-09 14:13:30.173009
3247	1	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:19.441266
3248	2	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.364523
3249	3	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.369422
3250	4	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.371688
3251	5	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.376243
3252	6	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.382488
3253	7	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.386076
3254	8	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.391353
3255	9	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:37:23.431818
3256	10	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:47.146429
3257	11	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:48.950015
3258	12	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:48.957749
3259	13	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:48.960382
3260	14	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:48.988829
3261	15	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:48.99326
3262	20	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.084916
3263	16	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.087098
3264	17	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.09449
3265	18	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.100745
3266	21	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.102506
3267	19	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.104621
3268	85	2026-07-09 17:00:00	{"_alarms": {}}	2026-07-09 17:38:49.109424
3269	1	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.870036
3270	2	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.873915
3271	3	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.875132
3272	4	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.876273
3273	5	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.877427
3274	6	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.878535
3275	7	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.879516
3276	8	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.880454
3277	9	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.881309
3278	10	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.88216
3279	11	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.883699
3280	12	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.884617
3281	13	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.885624
3282	14	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.886526
3283	15	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.887378
3284	20	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.888201
3285	16	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.889656
3286	17	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.890711
3287	18	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.891578
3288	21	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.89236
3289	19	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.893161
3290	85	2026-07-09 18:00:00	{"_alarms": {}}	2026-07-09 18:37:18.893858
3291	1	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.877713
3292	2	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.888696
3293	3	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.889736
3294	4	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.890723
3295	5	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.891663
3296	6	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.892542
3297	7	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.893459
3298	8	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.894877
3299	9	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.895794
3300	10	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.896705
3301	11	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.89759
3302	12	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.89835
3303	13	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.899019
3304	14	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.900372
3305	15	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.901165
3306	20	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.901898
3307	16	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.902698
3308	17	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.903408
3309	18	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.904782
3310	21	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.905459
3311	19	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.906162
3312	85	2026-07-09 19:00:00	{"_alarms": {}}	2026-07-09 19:37:18.906831
3313	1	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.750333
3314	2	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.764847
3315	3	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.766517
3316	4	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.767866
3317	5	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.769867
3318	6	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.771017
3319	7	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.77218
3320	8	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.773409
3321	9	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.774602
3322	10	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.775706
3323	11	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.777575
3324	12	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.778582
3325	13	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.779605
3326	14	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.780723
3327	15	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.781826
3328	20	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.784209
3329	16	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.785273
3330	17	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.786262
3331	18	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.787206
3332	21	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.788188
3333	19	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.789133
3334	85	2026-07-10 00:00:00	{"_alarms": {}}	2026-07-10 00:44:22.790071
3359	3	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.002145
3360	4	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.004148
3361	5	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.005713
3362	6	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.007484
3363	7	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.009104
3364	8	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.011308
3365	9	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.014448
3366	10	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.01633
3367	11	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.019189
3368	12	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.021371
3369	13	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.024479
3357	1	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:30.971239
3358	2	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:30.998919
4366	21	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.437985
4367	19	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.43906
4368	85	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.440007
3445	1	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.456171
3446	2	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.471487
3447	3	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.478333
3448	4	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.4832
3449	5	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.487372
3450	6	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.492388
3451	7	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.496511
3452	8	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.501382
3453	9	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.505561
3454	10	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.51053
3455	11	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.514735
3456	12	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.518931
3457	13	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.523367
3458	14	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.528749
3459	15	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.532656
3370	14	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.02691
3371	15	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.029966
3372	20	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.032209
3373	16	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.036537
3374	17	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.03889
3375	18	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.040999
3376	21	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.043091
3377	19	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.044892
3378	85	2026-07-10 18:00:00	{"_alarms": {}}	2026-07-10 18:47:31.046621
3460	20	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.536458
3461	16	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.540874
3462	17	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.545133
3463	18	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.550338
3464	21	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.554648
3465	19	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.559259
3466	85	2026-07-10 19:00:00	{"_alarms": {}}	2026-07-10 19:04:13.563158
4413	1	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.486455
4414	2	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.492547
4415	3	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.495133
4347	1	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.410017
4348	2	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.415552
4349	3	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.416878
4350	4	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.417947
4351	5	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.419493
4352	6	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.420671
4353	7	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.421821
4354	8	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.422939
4355	9	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.424071
4356	10	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.425174
4357	11	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.426762
4358	12	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.427966
4359	13	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.429474
4360	14	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.431073
4361	15	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.432431
4362	20	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.433528
4363	16	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.435048
4364	17	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.436143
4365	18	2026-07-10 20:00:00	{"_alarms": {}}	2026-07-10 20:14:31.437088
4431	18	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.539106
4432	21	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.541041
4433	19	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.543155
4434	85	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.545307
4416	4	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.49713
4417	5	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.499278
4422	10	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.514027
4423	11	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.516109
4424	12	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.518163
4425	13	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.520487
4426	14	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.524056
4664	10	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.31429
4665	11	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.319304
4666	12	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.324314
4667	13	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.329154
4418	6	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.501552
4419	7	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.50388
4420	8	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.509443
4421	9	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.511812
4427	15	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.526266
4428	20	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.528229
4429	16	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.530373
4430	17	2026-07-10 21:00:00	{"_alarms": {}}	2026-07-10 21:01:58.533007
4668	14	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.334781
4655	1	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.255909
4656	2	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.271112
4657	3	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.278163
4658	4	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.283672
4659	5	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.288685
4660	6	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.293831
4661	7	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.298523
4662	8	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.304633
4663	9	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.309753
4897	1	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.850082
4898	2	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.863984
4899	3	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.865802
4900	4	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.867229
4901	5	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.869815
4902	6	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.871385
4903	7	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.872619
4904	8	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.873841
4905	9	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.875008
4669	15	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.340512
4670	20	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.345909
4671	16	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.351315
4672	17	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.3563
4673	18	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.361001
4674	21	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.365406
4675	19	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.369654
4676	85	2026-07-10 22:00:00	{"_alarms": {}}	2026-07-10 22:11:02.373971
5453	7	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.193661
5454	8	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.197899
5455	9	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.200965
5456	10	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.204347
5457	11	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.208056
5458	12	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.211411
5459	13	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.215164
5460	14	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.218896
5461	15	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.221819
5462	20	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.225123
5463	16	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.228939
5464	17	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.23345
5465	18	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.236398
5381	1	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.56391
5382	2	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.586276
5383	3	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.588368
5384	4	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.58989
5385	5	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.59131
5386	6	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.594038
5387	7	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.59545
5388	8	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.596801
5389	9	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.598094
5390	10	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.599367
5391	11	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.600633
5392	12	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.601923
5393	13	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.604126
5394	14	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.605351
5395	15	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.606423
5396	20	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.607517
5397	16	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.608633
4906	10	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.876169
4907	11	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.878327
4908	12	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.87946
4909	13	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.880633
4910	14	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.881875
4911	15	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.88303
4912	20	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.884131
4913	16	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.886471
4914	17	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.888001
4915	18	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.889265
4916	21	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.890409
4917	19	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.891398
4918	85	2026-07-10 23:00:00	{"_alarms": {}}	2026-07-10 23:08:03.892409
5398	17	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.610511
5399	18	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.611512
5400	21	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.612602
5401	19	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.613576
5402	85	2026-07-11 13:00:00	{"_alarms": {}}	2026-07-11 13:50:12.614557
5447	1	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.156545
5448	2	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.168724
5449	3	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.173892
5450	4	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.179429
5451	5	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.184718
5452	6	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.189465
5466	21	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.239132
5467	19	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.243062
5468	85	2026-07-11 14:00:00	{"_alarms": {}}	2026-07-11 14:16:09.24566
5557	1	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.360611
5558	2	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.37193
5559	3	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.372984
5560	4	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.373962
5561	5	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.375542
5562	6	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.376534
5563	7	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.377467
5564	8	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.37829
5565	9	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.379076
5566	10	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.379907
5567	11	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.381036
5568	12	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.381793
5569	13	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.382582
5570	14	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.383489
5571	15	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.384242
5572	20	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.384954
5573	16	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.386258
5574	17	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.38697
5575	18	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.387724
5576	21	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.38839
5577	19	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.389057
5578	85	2026-07-11 15:00:00	{"_alarms": {}}	2026-07-11 15:23:48.389761
5579	1	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.371067
5580	2	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.376313
5581	3	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.378143
5582	4	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.380023
5583	5	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.382393
5584	6	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.384416
5585	7	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.386434
5586	8	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.388358
5587	9	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.39006
5588	10	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.391785
5589	11	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.393977
5590	12	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.395462
5591	13	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.397096
5592	14	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.398775
5593	15	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.400701
5594	20	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.40253
5595	16	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.404818
5596	17	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.406667
5597	18	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.408379
5598	21	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.410101
5599	19	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.411943
5600	85	2026-07-11 16:00:00	{"_alarms": {}}	2026-07-11 16:23:48.413644
5601	1	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.885089
5602	2	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.893806
5603	3	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.896038
5604	4	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.897605
5605	5	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.902246
5606	6	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.905204
5607	7	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.909475
5608	8	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.911281
5609	9	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.913982
5610	10	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.916543
5611	11	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.925078
5612	12	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.929046
5613	13	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.931234
5614	14	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.932572
5615	15	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.934413
5616	20	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.935808
5617	16	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.937582
5618	17	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.939049
5619	18	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.940382
5620	21	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.941689
5621	19	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.943013
5622	85	2026-07-11 17:00:00	{"_alarms": {}}	2026-07-11 17:30:54.944395
5623	1	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.357405
5624	2	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.364008
5625	3	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.365738
5626	4	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.367853
5627	5	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.37016
5628	6	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.371849
5629	7	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.373681
5630	8	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.375322
5631	9	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.377991
5632	10	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.379579
5633	11	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.403286
5634	12	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.404727
5635	13	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.406275
5636	14	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.407492
5637	15	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.408664
5638	20	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.409935
5639	16	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.411942
5640	17	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.414403
5641	18	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.416087
5642	21	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.417994
5643	19	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.419366
5644	85	2026-07-11 19:00:00	{"_alarms": {}}	2026-07-11 19:00:32.420838
5645	1	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.119197
5646	2	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.127004
5647	3	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.129465
5648	4	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.130909
5649	5	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.132348
5650	6	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.133866
5651	7	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.135705
5652	8	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.142817
5653	9	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.144536
5654	10	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.146042
5655	11	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.147235
5656	12	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.148388
5657	13	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.149739
5658	14	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.152672
5659	15	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.154213
5660	20	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.155896
5661	16	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.157137
5662	17	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.158458
5663	18	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.162237
5664	21	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.163703
5665	19	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.165384
5666	85	2026-07-11 20:00:00	{"_alarms": {}}	2026-07-11 20:58:56.16716
5667	1	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.406076
5668	2	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.419161
5669	3	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.422011
5670	4	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.426144
5671	5	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.429413
5672	6	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.430808
5673	7	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.432837
5674	8	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.435351
5675	9	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.437504
5676	10	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.439607
5677	11	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.446149
5678	12	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.447594
5679	13	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.449046
5680	14	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.450414
5681	15	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.451878
5682	20	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.454212
5683	16	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.456102
5684	17	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.457481
5685	18	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.459488
5686	21	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.460899
5687	19	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.462362
5688	85	2026-07-11 21:00:00	{"_alarms": {}}	2026-07-11 21:59:31.463853
5689	1	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.33231
5690	2	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.33654
5691	3	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.337644
5692	4	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.338645
5693	5	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.340504
5694	6	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.341466
5695	7	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.342386
5696	8	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.343322
5697	9	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.34421
5698	10	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.34518
5699	11	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.346561
5700	12	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.347415
5701	13	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.348251
5702	14	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.349088
5703	15	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.349858
5704	20	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.350602
5705	16	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.352095
5706	17	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.352868
5707	18	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.353853
5708	21	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.354581
5709	19	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.355356
5710	85	2026-07-11 22:00:00	{"_alarms": {}}	2026-07-11 22:59:31.356184
5711	1	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:52.945547
5712	2	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.522443
5713	3	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.52546
5714	4	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.52777
5715	5	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.533335
5716	6	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.537759
5717	7	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.60442
5718	8	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.83155
5719	9	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.833159
5720	10	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.834993
5721	11	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.836543
5722	12	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.838002
5723	13	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.947091
5724	14	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.949615
5725	15	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:53.951111
5726	20	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.016186
5727	16	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.019855
5728	17	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.045601
5729	18	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.047341
5730	21	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.049496
5731	19	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.051887
5732	85	2026-07-12 01:00:00	{"_alarms": {}}	2026-07-12 01:55:54.055188
5733	1	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.458289
5734	2	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.462092
5735	3	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.463557
5736	4	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.464764
5737	5	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.466002
5738	6	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.467109
5739	7	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.468195
5740	8	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.470035
5741	9	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.471039
5742	10	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.471989
5743	11	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.472965
5744	12	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.474455
5745	13	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.475513
5746	14	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.476592
5747	15	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.477609
5748	20	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.478595
5749	16	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.479527
5750	17	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.480488
5751	18	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.481426
5752	21	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.482644
5753	19	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.485892
5754	85	2026-07-12 08:00:00	{"_alarms": {}}	2026-07-12 08:19:54.486918
5755	1	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.304168
5756	2	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.341425
5757	3	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.345373
5758	4	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.348914
5759	5	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.353828
5760	6	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.356269
5761	7	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.358871
5762	8	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.361583
5763	9	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.364423
5764	10	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.36776
5765	11	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.371544
5766	12	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.373835
5767	13	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.376082
5768	14	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.378445
5769	15	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.380263
5770	20	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.383139
5771	16	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.386356
5772	17	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.389078
5773	18	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.391857
5774	21	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.394257
5775	19	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.396755
5776	85	2026-07-14 16:00:00	{"_alarms": {}}	2026-07-14 16:12:42.400994
5804	6	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.718417
5805	7	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.72022
5806	8	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.722895
5807	9	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.724505
5808	10	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.725846
5799	1	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.685852
5800	2	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.709081
5801	3	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.713719
5802	4	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.715491
5803	5	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.717022
5809	11	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.731558
5810	12	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.732912
5811	13	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.734423
5812	14	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.736543
5813	15	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.738085
5814	20	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.739574
5815	16	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.742817
5816	17	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.747736
5817	18	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.74915
5818	21	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.750613
5819	19	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.75236
5820	85	2026-07-15 18:00:00	{"_alarms": {}}	2026-07-15 18:25:00.753659
5865	1	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.219443
5866	2	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.231802
5867	3	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.232883
5868	4	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.233965
5869	5	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.234967
5870	6	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.235938
5871	7	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.236882
5872	8	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.238373
5873	9	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.239277
5874	10	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.240299
5875	11	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.241204
5876	12	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.242089
5877	13	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.242914
5878	14	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.244632
5879	15	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.245448
5880	20	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.246271
5881	16	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.247437
5882	17	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.249222
5883	18	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.250114
5884	21	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.250872
5885	19	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.251557
5886	85	2026-07-15 19:00:00	{"_alarms": {}}	2026-07-15 19:40:24.252201
5887	1	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.447269
5888	2	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.463958
5889	3	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.466066
5890	4	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.468501
5891	5	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.471395
5892	6	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.472864
5893	7	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.475214
5894	8	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.476536
5895	9	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.477883
5896	10	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.479284
5897	11	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.485749
5898	12	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.487071
5899	13	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.489429
5900	14	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.491742
5901	15	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.494217
5902	20	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.498506
5903	16	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.500746
5904	17	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.50217
5905	18	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.505862
5906	21	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.507261
5907	19	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.509402
5908	85	2026-07-15 21:00:00	{"_alarms": {}}	2026-07-15 21:24:53.511772
5909	1	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.432573
5910	2	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.436031
5911	3	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.436872
5912	4	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.438449
5913	5	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.440577
5914	6	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.441814
5915	7	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.442887
5916	8	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.443778
5917	9	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.444503
5918	10	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.445239
5919	11	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.446416
5920	12	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.447072
5921	13	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.447736
5922	14	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.448375
5923	15	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.448988
5924	20	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.449585
5925	16	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.450764
5926	17	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.45139
5927	18	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.45204
5928	21	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.452644
5929	19	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.453327
5930	85	2026-07-15 22:00:00	{"_alarms": {}}	2026-07-15 22:24:53.453976
5931	1	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.448158
5932	2	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.45247
5933	3	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.453561
5934	4	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.454627
5935	5	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.456816
5936	6	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.458339
5937	7	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.459443
5938	8	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.460946
5939	9	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.461911
5940	10	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.462889
5941	11	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.463841
5942	12	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.464954
5943	13	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.465873
5944	14	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.467352
5945	15	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.468214
5946	20	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.469096
5947	16	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.469953
5948	17	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.470677
5949	18	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.471444
5950	21	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.472158
5951	19	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.473154
5952	85	2026-07-15 23:00:00	{"_alarms": {}}	2026-07-15 23:24:53.474446
5953	1	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.304631
5954	2	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.329786
5955	3	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.331186
5956	4	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.333448
5957	5	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.334466
5958	6	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.335528
5959	7	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.337222
5960	8	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.338232
5961	9	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.339171
5962	10	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.340257
5963	11	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.341232
5964	12	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.342168
5965	13	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.343748
5966	14	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.344761
5967	15	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.345792
5968	20	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.346935
5969	16	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.348641
5970	17	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.349637
5971	18	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.350681
5972	21	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.351692
5973	19	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.352669
5974	85	2026-07-16 20:00:00	{"_alarms": {}}	2026-07-16 20:54:12.353731
5975	1	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.344781
5976	2	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.348992
5977	3	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.350045
5978	4	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.351337
5979	5	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.352095
5980	6	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.352669
5981	7	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.353723
5982	8	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.354627
5983	9	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.355462
5984	10	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.356397
5985	11	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.357003
5986	12	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.357788
5987	13	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.359267
5988	14	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.360089
5989	15	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.361034
5990	20	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.361755
5991	16	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.362516
5992	17	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.363229
5993	18	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.364101
5994	21	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.364769
5995	19	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.36539
5996	85	2026-08-06 18:00:00	{"_alarms": {}}	2026-08-06 18:47:02.366152
5997	1	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:46.625446
5998	2	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.025185
5999	3	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.02619
6000	4	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.027114
6001	5	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.028419
6002	6	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.02926
6003	7	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.030145
6004	8	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.031009
6005	9	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.031973
6006	10	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.033691
6007	11	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.034625
6008	12	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.035799
6009	13	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.036647
6010	14	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.037478
6011	15	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.041876
6012	20	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.042791
6013	16	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.043718
6014	17	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.044669
6015	18	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.046141
6016	21	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.047092
6017	19	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.048054
6018	85	2026-08-07 03:00:00	{"_alarms": {}}	2026-08-07 03:13:47.04892
6019	1	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.100084
6020	2	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.130062
6021	3	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.131001
6022	4	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.131909
6023	5	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.132741
6024	6	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.133578
6025	7	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.134535
6026	8	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.135356
6027	9	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.136144
6028	10	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.527796
6029	11	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.528737
6030	12	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.529695
6031	13	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.53081
6032	14	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.531604
6033	15	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.532927
6034	20	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.533874
6035	16	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.53479
6036	17	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.535563
6037	18	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.537316
6038	21	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.538212
6039	19	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.539053
6040	85	2026-08-07 10:00:00	{"_alarms": {}}	2026-08-07 10:00:31.539997
6041	1	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.425096
6042	2	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.430295
6043	3	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.431322
6044	4	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.432827
6045	5	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.433582
6046	6	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.434246
6047	7	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.435152
6048	8	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.435944
6049	9	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.436799
6050	10	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.437896
6051	11	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.438679
6052	12	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.439399
6053	13	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.440161
6054	14	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.440855
6055	15	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.441886
6056	20	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.442828
6057	16	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.443793
6058	17	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.444679
6059	18	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.445537
6060	21	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.447555
6061	19	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.448557
6062	85	2026-08-07 11:00:00	{"_alarms": {}}	2026-08-07 11:02:05.449517
6063	1	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.480191
6064	2	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.482793
6065	3	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.483764
6066	4	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.484415
6067	5	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.485029
6068	6	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.485596
6069	7	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.486798
6070	8	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.487479
6071	9	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.488097
6072	10	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.488642
6073	11	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.489139
6074	12	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.489835
6075	13	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.490315
6076	14	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.490816
6077	15	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.491587
6078	20	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.492427
6079	16	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.493415
6080	17	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.494204
6081	18	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.494789
6082	21	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.495281
6083	19	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.495782
6084	85	2026-08-07 12:00:00	{"_alarms": {}}	2026-08-07 12:02:05.496817
6085	1	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:43.951874
6086	2	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.055566
6087	3	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.056852
6088	4	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.058184
6089	5	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.059383
6090	6	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.06057
6091	7	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.062313
6092	8	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.063323
6093	9	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.064402
6094	10	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.065563
6095	11	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.066706
6096	12	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.068083
6097	13	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.069275
6098	14	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.071173
6099	15	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.072288
6100	20	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.073519
6101	16	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.074981
6102	17	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.076045
6103	18	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.077263
6104	21	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.080686
6105	19	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.082546
6106	85	2026-08-07 14:00:00	{"_alarms": {}}	2026-08-07 14:38:44.083961
6107	1	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.439561
6108	2	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.444591
6109	3	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.449469
6110	4	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.450584
6111	5	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.451909
6112	6	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.452948
6113	7	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.453819
6114	8	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.454618
6115	9	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.455719
6116	10	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.456681
6117	11	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.457711
6118	12	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.458693
6119	13	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.459859
6120	14	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.460848
6121	15	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.461905
6122	20	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.464523
6123	16	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.46574
6124	17	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.466864
6125	18	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.467916
6126	21	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.468889
6127	19	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.469954
6128	85	2026-08-07 17:00:00	{"_alarms": {}}	2026-08-07 17:10:28.47103
6129	1	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.449273
6130	2	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.452942
6131	3	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.454163
6132	4	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.455279
6133	5	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.456324
6134	6	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.457726
6135	7	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.458773
6136	8	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.459829
6137	9	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.463506
6138	10	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.464633
6139	11	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.465674
6140	12	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.466682
6141	13	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.467918
6142	14	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.469272
6143	15	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.470789
6144	20	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.472848
6145	16	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.473903
6146	17	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.475159
6147	18	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.476328
6148	21	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.47735
6149	19	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.478523
6150	85	2026-08-07 18:00:00	{"_alarms": {}}	2026-08-07 18:41:46.480171
6151	1	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.274376
6152	2	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.283848
6153	3	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.284472
6154	4	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.285163
6155	5	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.285699
6156	6	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.286265
6157	7	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.287009
6158	8	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.288739
6159	9	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.28936
6160	10	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.289823
6161	11	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.290309
6162	12	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.291128
6163	13	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.291576
6164	14	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.292046
6165	15	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.292489
6166	20	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.293025
6167	16	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.29419
6168	17	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.294981
6169	18	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.296491
6170	21	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.297762
6171	19	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.299324
6172	85	2026-08-07 19:00:00	{"_alarms": {}}	2026-08-07 19:41:48.299861
6173	1	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.986011
6174	2	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.990683
6175	3	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.993268
6176	4	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.994813
6177	5	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.996207
6178	6	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:13.999243
6179	7	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.001138
6180	8	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.002929
6181	9	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.004782
6182	10	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.006095
6183	11	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.00737
6184	12	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.008908
6185	13	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.010197
6186	14	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.012397
6187	15	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.013707
6188	20	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.015095
6189	16	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.016629
6190	17	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.018781
6191	18	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.020097
6192	21	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.021396
6193	19	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.022677
6194	85	2026-08-07 21:00:00	{"_alarms": {}}	2026-08-07 21:12:14.024494
6195	1	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.440003
6196	2	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.662531
6197	3	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.664343
6198	4	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.690446
6199	5	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.691966
6200	6	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.693225
6201	7	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.694544
6202	8	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.695538
6203	9	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.69679
6204	10	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.698563
6205	11	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.700417
6206	12	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.701993
6207	13	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.703428
6208	14	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.705112
6209	15	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.706699
6210	20	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.707971
6211	16	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.709536
6212	17	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.710778
6213	18	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.7127
6214	21	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.713926
6215	19	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.715046
6216	85	2026-08-08 02:00:00	{"_alarms": {}}	2026-08-08 02:02:48.716199
6217	1	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.255409
6218	2	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.443041
6219	3	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.444666
6220	4	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.446223
6221	5	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.447089
6222	6	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.44828
6223	7	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.449141
6224	8	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.450088
6225	9	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.451011
6226	10	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.452374
6227	11	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.453399
6228	12	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.454267
6229	13	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.455053
6230	14	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.455948
6231	15	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.456838
6232	20	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.457682
6233	16	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.458902
6234	17	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.459776
6235	18	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.462916
6236	21	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.465908
6237	19	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.468318
6238	85	2026-08-08 08:00:00	{"_alarms": {}}	2026-08-08 08:15:06.470156
6239	1	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.793095
6240	2	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.801538
6241	3	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.80288
6242	4	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.804585
6243	5	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.805856
6244	6	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.80717
6245	7	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.808519
6246	8	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.810466
6247	9	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.8118
6248	10	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.813144
6249	11	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.815371
6250	12	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.816962
6251	13	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.818391
6252	14	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.822056
6253	15	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.823483
6254	20	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.825045
6255	16	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.828012
6256	17	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.829537
6257	18	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.830807
6258	21	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.832057
6259	19	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.833441
6260	85	2026-08-08 10:00:00	{"_alarms": {}}	2026-08-08 10:36:06.834783
6261	1	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.208435
6262	2	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.222445
6263	3	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.223229
6264	4	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.22385
6265	5	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.224492
6266	6	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.225197
6267	7	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.227472
6268	8	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.2284
6269	9	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.229367
6270	10	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.231216
6271	11	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.232682
6272	12	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.233386
6273	13	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.234239
6274	14	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.235138
6275	15	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.235872
6276	20	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.236613
6277	16	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.237451
6278	17	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.238964
6279	18	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.239706
6280	21	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.240426
6281	19	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.241092
6282	85	2026-08-08 11:00:00	{"_alarms": {}}	2026-08-08 11:36:06.241687
6283	1	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.212309
6284	2	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.225736
6285	3	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.226785
6286	4	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.227424
6287	5	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.22795
6288	6	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.228447
6289	7	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.228991
6290	8	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.229452
6291	9	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.2299
6292	10	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.230446
6293	11	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.231601
6294	12	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.232084
6295	13	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.232852
6296	14	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.233547
6297	15	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.234706
6298	20	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.235356
6299	16	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.236024
6300	17	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.236634
6301	18	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.237495
6302	21	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.238274
6303	19	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.239563
6304	85	2026-08-08 12:00:00	{"_alarms": {}}	2026-08-08 12:36:06.240307
6305	1	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.213009
6306	2	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.230703
6307	3	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.231295
6308	4	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.232165
6309	5	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.233265
6310	6	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.23445
6311	7	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.235251
6312	8	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.235901
6313	9	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.236496
6314	10	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.237017
6315	11	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.237601
6316	12	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.238175
6317	13	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.239175
6318	14	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.239772
6319	15	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.240518
6320	20	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.241227
6321	16	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.242144
6322	17	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.242699
6323	18	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.243306
6324	21	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.244038
6325	19	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.24461
6326	85	2026-08-08 13:00:00	{"_alarms": {}}	2026-08-08 13:36:06.245137
6327	1	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.227726
6328	2	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.24272
6329	3	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.243502
6330	4	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.244106
6331	5	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.244789
6332	6	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.245333
6333	7	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.246171
6334	8	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.246873
6335	9	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.248448
6336	10	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.249065
6337	11	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.249969
6338	12	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.250511
6339	13	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.25098
6340	14	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.251475
6341	15	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.252077
6342	20	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.253019
6343	16	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.253783
6344	17	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.254284
6345	18	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.254788
6346	21	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.255324
6347	19	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.255833
6348	85	2026-08-08 14:00:00	{"_alarms": {}}	2026-08-08 14:36:06.256653
6349	1	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.404421
6350	2	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.414595
6351	3	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.415698
6352	4	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.417083
6353	5	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.417978
6354	6	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.418629
6355	7	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.41937
6356	8	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.42022
6357	9	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.421163
6358	10	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.421863
6359	11	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.422602
6360	12	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.423345
6361	13	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.424057
6362	14	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.42514
6363	15	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.425878
6364	20	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.426923
6365	16	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.428308
6366	17	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.429534
6367	18	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.430577
6368	21	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.431469
6369	19	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.432224
6370	85	2026-08-08 15:00:00	{"_alarms": {}}	2026-08-08 15:26:29.432984
6394	2	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.958917
6393	1	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.953778
6395	3	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.960157
6396	4	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.961723
6397	5	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.962489
6398	6	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.963115
6399	7	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.963703
6400	8	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.965405
6401	9	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.96622
6402	10	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.966984
6403	11	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.967632
6404	12	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.968382
6405	13	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.969038
6406	14	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.969978
6407	15	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.970692
6408	20	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.97138
6409	16	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.972507
6410	17	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.973265
6411	18	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.974055
6412	21	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.974751
6413	19	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.975501
6414	85	2026-08-10 11:00:00	{"_alarms": {}}	2026-08-10 11:46:14.976273
6437	1	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.629268
6438	2	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.641991
6439	3	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.64264
6440	4	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.643167
6441	5	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.643654
6442	6	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.644227
6443	7	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.64523
6444	8	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.645949
6445	9	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.64667
6446	10	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.647167
6447	11	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.647924
6448	12	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.648374
6449	13	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.648869
6450	14	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.649323
6451	15	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.649998
6452	20	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.650444
6453	16	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.650908
6454	17	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.651358
6455	18	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.652013
6456	21	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.652825
6457	19	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.653318
6458	85	2026-08-10 12:00:00	{"_alarms": {}}	2026-08-10 12:50:39.65377
6459	1	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.6295
6460	2	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.631599
6461	3	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.632671
6462	4	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.633235
6463	5	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.634033
6464	6	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.634678
6465	7	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.635489
6466	8	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.636055
6467	9	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.636533
6468	10	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.63702
6469	11	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.637487
6470	12	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.639373
6471	13	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.639889
6472	14	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.64045
6473	15	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.640932
6474	20	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.641384
6475	16	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.641824
6476	17	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.642314
6477	18	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.643052
6478	21	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.643763
6479	19	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.64444
6480	85	2026-08-10 13:00:00	{"_alarms": {}}	2026-08-10 13:50:39.644969
6481	1	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.632952
6482	2	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.635308
6483	3	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.636346
6484	4	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.63721
6485	5	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.637877
6486	6	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.63846
6487	7	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.639195
6488	8	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.639654
6489	9	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.640119
6490	10	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.640562
6491	11	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.641014
6492	12	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.641706
6493	13	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.642146
6494	14	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.64313
6495	15	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.643725
6496	20	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.644337
6497	16	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.644972
6498	17	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.645645
6499	18	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.646214
6500	21	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.646884
6501	19	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.647498
6502	85	2026-08-10 14:00:00	{"_alarms": {}}	2026-08-10 14:50:39.648279
6503	1	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.066821
6504	2	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.070466
6505	3	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.07153
6506	4	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.073379
6507	5	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.074279
6508	6	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.075047
6509	7	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.075864
6510	8	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.076638
6511	9	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.077626
6512	10	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.078664
6513	11	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.079584
6514	12	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.080781
6515	13	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.081831
6516	14	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.083013
6517	15	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.084204
6518	20	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.084978
6519	16	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.085721
6520	17	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.086415
6521	18	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.087156
6522	21	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.088011
6523	19	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.088739
6524	85	2026-08-10 16:00:00	{"_alarms": {}}	2026-08-10 16:30:24.089425
6525	1	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.019767
6526	2	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.023984
6527	3	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.024708
6528	4	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.025674
6529	5	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.026723
6530	6	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.027355
6531	7	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.028126
6532	8	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.028798
6533	9	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.029328
6534	10	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.029929
6535	11	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.030928
6536	12	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.031748
6537	13	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.032518
6538	14	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.033345
6539	15	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.034432
6540	20	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.035136
6541	16	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.035924
6542	17	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.036569
6543	18	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.037446
6544	21	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.037971
6545	19	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.038652
6546	85	2026-08-10 17:00:00	{"_alarms": {}}	2026-08-10 17:30:25.039369
6547	1	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.017312
6548	2	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.033277
6549	3	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.034108
6550	4	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.034693
6551	5	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.035327
6552	6	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.035911
6553	7	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.036725
6554	8	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.037877
6555	9	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.038648
6556	10	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.039479
6557	11	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.039994
6558	12	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.04049
6559	13	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.04112
6560	14	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.042029
6561	15	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.042712
6562	20	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.043226
6563	16	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.043848
6564	17	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.0445
6565	18	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.045229
6566	21	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.045746
6567	19	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.046261
6568	85	2026-08-10 18:00:00	{"_alarms": {}}	2026-08-10 18:30:25.046947
6569	1	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.019389
6570	2	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.024442
6571	3	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.025219
6572	4	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.02614
6573	5	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.026684
6574	6	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.027271
6575	7	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.027868
6576	8	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.028509
6577	9	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.029376
6578	10	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.029965
6579	11	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.030531
6580	12	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.031204
6581	13	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.031766
6582	14	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.032632
6583	15	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.033319
6584	20	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.033989
6585	16	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.034878
6586	17	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.035402
6587	18	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.035921
6588	21	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.036449
6589	19	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.037059
6590	85	2026-08-10 19:00:00	{"_alarms": {}}	2026-08-10 19:30:25.037648
6591	1	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.04233
6592	2	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.046759
6593	3	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.048028
6594	4	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.048939
6595	5	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.049715
6596	6	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.050553
6597	7	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.05179
6598	8	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.052658
6599	9	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.053401
6600	10	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.054033
6601	11	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.054815
6602	12	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.055825
6603	13	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.056815
6604	14	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.057667
6605	15	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.058668
6606	20	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.06064
6607	16	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.061571
6608	17	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.062447
6609	18	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.063347
6610	21	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.064165
6611	19	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.065208
6612	85	2026-08-10 20:00:00	{"_alarms": {}}	2026-08-10 20:30:25.066169
6613	1	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.037093
6614	2	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.040106
6615	3	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.041237
6616	4	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.04193
6617	5	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.042788
6618	6	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.043371
6619	7	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.044077
6620	8	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.044822
6621	9	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.045628
6622	10	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.04622
6623	11	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.047105
6624	12	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.047635
6625	13	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.04824
6626	14	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.04883
6627	15	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.049618
6628	20	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.050086
6629	16	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.050571
6630	17	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.051283
6631	18	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.051818
6632	21	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.05234
6633	19	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.052833
6634	85	2026-08-10 21:00:00	{"_alarms": {}}	2026-08-10 21:30:25.053362
6635	1	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.614486
6636	2	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.671655
6637	3	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.672701
6638	4	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.766899
6639	5	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.768148
6640	6	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.769029
6641	7	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.769956
6642	8	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.775555
6643	9	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.77682
6644	10	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.777858
6645	11	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.778842
6646	12	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.781925
6647	13	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.783166
6648	14	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.784324
6649	15	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.785533
6650	20	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.791724
6651	16	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.79276
6652	17	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.79427
6653	18	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.795402
6654	21	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.796229
6655	19	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.800627
6656	85	2026-08-11 01:00:00	{"_alarms": {}}	2026-08-11 01:48:55.801779
6657	1	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.317909
6658	2	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.330987
6659	3	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.333232
6660	4	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.335089
6661	5	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.337187
6662	6	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.339096
6663	7	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.341121
6664	8	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.343187
6665	9	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.345107
6666	10	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.348088
6667	11	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.350093
6668	12	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.352577
6669	13	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.354362
6670	14	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.357825
6671	15	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.359961
6672	20	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.361671
6673	16	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.364515
6674	17	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.366178
6675	18	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.368196
6676	21	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.370154
6677	19	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.371721
6678	85	2026-08-11 04:00:00	{"_alarms": {}}	2026-08-11 04:32:10.373586
6679	1	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.804849
6680	2	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.807589
6681	3	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.808795
6682	4	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.809905
6683	5	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.81092
6684	6	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.812818
6685	7	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.814088
6686	8	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.81583
6687	9	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.817333
6688	10	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.818812
6689	11	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.83654
6690	12	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.837686
6691	13	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.838887
6692	14	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.840102
6693	15	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.841224
6694	20	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.842444
6695	16	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.84374
6696	17	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.844918
6697	18	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.846627
6698	21	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.848133
6699	19	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.849395
6700	85	2026-08-11 11:00:00	{"_alarms": {}}	2026-08-11 11:57:04.850611
6701	1	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:17.679347
6702	2	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.40181
6703	3	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.403062
6704	4	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.404057
6705	5	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.405776
6706	6	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.408208
6707	7	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.409792
6708	8	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.41081
6709	9	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.411943
6710	10	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.412902
6711	11	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.413915
6712	12	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.415244
6713	13	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.417184
6714	14	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.419247
6715	15	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.420304
6716	20	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.421131
6717	16	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.422121
6718	17	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.424032
6719	18	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.528934
6720	21	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.530746
6721	19	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.532706
6722	85	2026-08-11 17:00:00	{"_alarms": {}}	2026-08-11 17:46:18.53437
6723	1	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.572278
6724	2	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.580322
6725	3	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.581509
6726	4	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.582405
6727	5	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.5832
6728	6	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.58386
6729	7	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.584676
6730	8	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.586134
6731	9	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.587165
6732	10	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.588021
6733	11	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.589012
6734	12	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.589656
6735	13	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.590372
6736	14	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.591164
6737	15	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.592363
6738	20	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.593009
6739	16	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.593882
6740	17	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.594595
6741	18	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.595217
6742	21	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.595807
6743	19	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.596339
6744	85	2026-08-11 18:00:00	{"_alarms": {}}	2026-08-11 18:46:16.596823
6745	1	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.554086
6746	2	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.557816
6747	3	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.558476
6748	4	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.559002
6749	5	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.560086
6750	6	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.560726
6751	7	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.561377
6752	8	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.56205
6753	9	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.563415
6754	10	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.564528
6755	11	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.565289
6756	12	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.565988
6757	13	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.566631
6758	14	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.567419
6759	15	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.567998
6760	20	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.568516
6761	16	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.56905
6762	17	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.569624
6763	18	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.570346
6764	21	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.571053
6765	19	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.571798
6766	85	2026-08-11 19:00:00	{"_alarms": {}}	2026-08-11 19:46:16.572519
6767	1	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.552588
6768	2	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.554557
6769	3	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.55562
6770	4	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.556653
6771	5	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.557578
6772	6	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.558436
6773	7	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.559489
6774	8	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.560322
6775	9	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.561109
6776	10	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.561893
6777	11	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.562607
6778	12	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.563631
6779	13	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.564363
6780	14	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.56509
6781	15	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.565946
6782	20	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.567153
6783	16	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.568109
6784	17	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.568738
6785	18	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.569437
6786	21	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.570002
6787	19	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.571
6788	85	2026-08-11 20:00:00	{"_alarms": {}}	2026-08-11 20:46:16.572826
6789	1	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.555419
6790	2	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.557101
6791	3	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.557673
6792	4	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.558485
6793	5	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.559028
6794	6	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.559556
6795	7	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.560119
6796	8	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.56067
6797	9	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.56142
6798	10	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.561961
6799	11	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.562479
6800	12	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.56338
6801	13	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.5639
6802	14	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.564423
6803	15	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.564941
6804	20	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.565459
6805	16	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.566224
6806	17	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.566724
6807	18	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.567245
6808	21	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.568341
6809	19	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.569185
6810	85	2026-08-11 21:00:00	{"_alarms": {}}	2026-08-11 21:46:16.569733
6811	1	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.558783
6812	2	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.577103
6813	3	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.577713
6814	4	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.578495
6815	5	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.579082
6816	6	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.580154
6817	7	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.580708
6818	8	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.581214
6819	9	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.581933
6820	10	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.582449
6821	11	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.582985
6822	12	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.583885
6823	13	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.584455
6824	14	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.584972
6825	15	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.58551
6826	20	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.586033
6827	16	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.586537
6828	17	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.587038
6829	18	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.587554
6830	21	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.58808
6831	19	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.588624
6832	85	2026-08-11 22:00:00	{"_alarms": {}}	2026-08-11 22:46:16.589131
6833	1	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.57859
6834	2	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.580827
6835	3	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.581357
6836	4	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.582167
6837	5	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.582719
6838	6	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.583495
6839	7	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.584241
6840	8	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.584697
6841	9	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.58515
6842	10	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.585614
6843	11	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.586099
6844	12	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.586805
6845	13	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.587258
6846	14	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.58771
6847	15	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.588159
6848	20	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.588771
6849	16	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.589352
6850	17	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.589811
6851	18	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.590489
6852	21	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.591124
6853	19	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.591858
6854	85	2026-08-11 23:00:00	{"_alarms": {}}	2026-08-11 23:46:16.59254
6855	1	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.159691
6856	2	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.179312
6857	3	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.192264
6858	4	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.193331
6859	5	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.194253
6860	6	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.195239
6861	7	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.201197
6862	8	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.202431
6863	9	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.203452
6864	10	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.204347
6865	11	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.210698
6866	12	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.211651
6867	13	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.212596
6868	14	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.213724
6869	15	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.214654
6870	20	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.215604
6871	16	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.216476
6872	17	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.218089
6873	18	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.218922
6874	21	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.219857
6875	19	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.220911
6876	85	2026-08-12 07:00:00	{"_alarms": {}}	2026-08-12 07:47:03.221994
6877	1	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.004614
6878	2	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.029798
6879	3	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.03125
6880	4	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.032376
6881	5	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.033701
6882	6	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.039201
6883	7	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.042937
6884	8	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.04397
6885	9	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.045027
6886	10	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.045964
6887	11	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.047436
6888	12	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.04834
6889	13	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.049342
6890	14	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.05708
6891	15	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.058732
6892	20	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.060344
6893	16	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.062045
6894	17	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.063236
6895	18	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.064542
6896	21	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.066007
6897	19	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.067488
6898	85	2026-08-12 10:00:00	{"_alarms": {}}	2026-08-12 10:02:24.068515
6899	1	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.717429
6900	2	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.72899
6901	3	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.73013
6902	4	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.731302
6903	5	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.73225
6904	6	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.733224
6905	7	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.734437
6906	8	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.735292
6907	9	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.736478
6908	10	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.73709
6909	11	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.737809
6910	12	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.73887
6911	13	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.74022
6912	14	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.741972
6913	15	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.742911
6914	20	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.743932
6915	16	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.744649
6916	17	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.745355
6917	18	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.746704
6918	21	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.747417
6919	19	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.748054
6920	85	2026-08-12 11:00:00	{"_alarms": {}}	2026-08-12 11:02:23.748631
\.


--
-- Data for Name: section_process_readings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_process_readings (id, section_id, equipment_id, tag_name, parameter_name, value, uom, reading_time, shift_id, recorded_by, source, created_at) FROM stdin;
1	1	\N	WIRE-VAC-P1	Wire Vacuum P1	2.5000	kPa	2026-07-05 18:46:58.876415	\N	3	Manual	2026-07-05 18:46:58.876415
2	1	\N	WIRE-VAC-P1	Wire Vacuum P1	3.1000	kPa	2026-07-05 18:52:25.725441	\N	3	Manual	2026-07-05 18:52:25.725441
3	11	3	PM1_WIRE_VAC_P1	Wire Suction Box Vacuum	20.4500	kPa	2026-07-05 19:55:54.158	\N	\N	SCADA	2026-07-06 01:25:54.159438
4	18	37	BOILER-MAIN-01	Rice Husk Boiler Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
5	17	38	ETP-AERATOR-02	Aeration Basin Aerator Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
6	19	39	LAB-SCALE-01	Digital GSM Scale Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
7	20	40	CRN-JUMBO-01	Overhead Jumbo Reel Crane Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
8	16	41	STEAM-PUMP-01	Condensate Return Pump Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
9	15	42	STARCH-MIX-01	Starch Cooking Agitator Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
10	85	43	STORE-SCALE-01	Inventory Weigh Scale Status	1.0000	ON/OFF	2026-07-06 01:29:29.873663	\N	\N	SCADA	2026-07-06 01:39:29.873663
\.


--
-- Data for Name: section_sops; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.section_sops (id, section_id, sop_type, title, version, steps, approved_by, approved_at, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sections (id, name, code, department_id, is_active, created_at) FROM stdin;
9	Pulp mill Section	PULPMILL	1	t	2026-06-29 13:37:22.464509
10	Centricleaner Section	CENTRICLEANER	1	t	2026-06-29 13:37:22.464509
11	Wire Section	WIRE	1	t	2026-06-29 13:37:22.464509
12	Vacuum Section	VACUUM	1	t	2026-06-29 13:37:22.464509
13	Press Section	PRESS	1	t	2026-06-29 13:37:22.464509
14	Unirun Section	UNIRUN	1	t	2026-06-29 13:37:22.464509
15	Pre Dryer Section	PRE_DRYER	1	t	2026-06-29 13:37:22.464509
16	Size Press Section	SIZE_PRESS	1	t	2026-06-29 13:37:22.464509
17	Size kitchen Section	SIZE_KITCHEN	1	t	2026-06-29 13:37:22.464509
18	Post Dryer Section	POST_DRYER	1	t	2026-06-29 13:37:22.464509
19	Calender Section	CALENDER	1	t	2026-06-29 13:37:22.464509
20	Pope Reel Section	POPE_REEL	1	t	2026-06-29 13:37:22.464509
21	Rewinder Section	REWINDER	1	t	2026-06-29 13:37:22.464509
22	Starch kitchen Section	STARCH_KITCHEN	1	t	2026-06-29 13:37:22.464509
23	Steam & Condensate Section	STEAM_COND	1	t	2026-06-29 13:37:22.464509
24	ETP Section	ETP	17	t	2026-06-29 13:37:22.464509
25	Boiler Section	BOILER	9	t	2026-06-29 13:37:22.464509
26	Lab Section	LAB	14	t	2026-06-29 13:37:22.464509
27	Cranes	CRANES	8	t	2026-06-29 13:37:22.464509
28	Compressors & Air Dryer	COMPRESSORS	9	t	2026-06-29 13:37:22.464509
29	Store Section	STORE	4	t	2026-06-29 13:37:22.464509
\.


--
-- Data for Name: separation_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.separation_records (id, employee_id, separation_type, resignation_date, last_working_date, notice_period_days, notice_served_days, notice_buyout, reason, status, service_years, gratuity_amount, leave_encashment, bonus_payable, deductions, net_ff_amount, ff_paid_date, initiated_by, approved_by, closed_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: shift_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shift_reports (id, date, shift_type, section, operator_id, data, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shifts (id, date, shift_type, start_time, end_time, supervisor_id, machine_id, remarks, created_at, status) FROM stdin;
1	2026-07-05	Day	2026-07-06 00:13:00	2026-07-06 00:15:00	1	1	\N	2026-07-06 00:14:00.410294	Open
2	2026-07-08	Day	2026-07-08 12:49:00	2026-07-09 12:49:00	1	1	jhgg	2026-07-08 12:49:20.882306	Open
3	2026-07-11	Day	2026-07-11 14:36:00	2026-07-12 14:36:00	1	1	shift starting. 	2026-07-11 14:39:27.329021	Open
\.


--
-- Data for Name: stock_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_ledger (id, material_id, date, transaction_type, reference_id, reference_type, in_qty, out_qty, balance, unit_price, value, batch_number, bin_location, remarks, created_by, created_at, shift, is_high_txn) FROM stdin;
\.


--
-- Data for Name: store_indent_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.store_indent_log (id, indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, qty, note, created_at) FROM stdin;
\.


--
-- Data for Name: store_indents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.store_indents (id, indent_number, indent_date, department_id, material_id, qty_requested, qty_issued, unit, purpose, priority, status, requested_by, approved_by, approved_at, issued_by, issued_at, closed_by, closed_at, reject_reason, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: store_issues; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.store_issues (id, issue_number, issue_date, material_id, department_id, quantity, unit, purpose, issued_by, approved_by, status, remarks, created_at, indent_type, machine_id, position_id, justification, estimated_value, required_by_date, issue_option, substitute_material_id, serial_number, batch_number, acknowledged_at, acknowledged_by) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, key, value, category, label, updated_by, updated_at) FROM stdin;
1	company_name	MK Paper Mill	Company	Company Name	\N	2026-06-29 00:14:06.266192
2	company_address		Company	Address	\N	2026-06-29 00:14:06.266192
3	company_phone		Company	Phone	\N	2026-06-29 00:14:06.266192
4	company_email		Company	Email	\N	2026-06-29 00:14:06.266192
5	company_gst		Company	GST Number	\N	2026-06-29 00:14:06.266192
6	company_pan		Company	PAN	\N	2026-06-29 00:14:06.266192
7	financial_year_start	04	System	Financial Year Start Month	\N	2026-06-29 00:14:06.266192
8	low_stock_alert_days	7	System	Low Stock Alert Days	\N	2026-06-29 00:14:06.266192
9	sequence_prefix_indent	IND	System	Indent Prefix	\N	2026-06-29 00:14:06.266192
10	sequence_prefix_po	PO	System	PO Prefix	\N	2026-06-29 00:14:06.266192
11	sequence_prefix_so	SO	System	SO Prefix	\N	2026-06-29 00:14:06.266192
12	sequence_prefix_do	DO	System	DO Prefix	\N	2026-06-29 00:14:06.266192
13	approval_threshold_value	50000	Approvals	High Value Threshold (INR) — needs Plant Head	\N	2026-06-29 09:48:42.907258
14	approval_threshold_qty	1000	Approvals	High Qty Threshold (units) — needs Plant Head	\N	2026-06-29 09:48:42.907258
\.


--
-- Data for Name: training_attendance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.training_attendance (id, training_id, employee_id, nominated_by, status, feedback, score, certificate_url, attended_on, created_at) FROM stdin;
\.


--
-- Data for Name: training_programs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.training_programs (id, title, category, trainer_name, trainer_type, venue, scheduled_date, duration_hours, max_nominees, department_ids, status, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, employee_code, name, email, mobile, password_hash, role_id, department_id, shift, is_active, last_login, created_at, updated_at, must_change_password) FROM stdin;
21	DH-PACK	Head - Packing	head.pack@mkpapermill.com	9000000019	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	19	\N	t	2026-06-30 11:51:07.757999	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
16	DH-LAB	Head - Laboratory	head.lab@mkpapermill.com	9000000014	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	14	\N	t	2026-07-11 14:41:53.008227	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
17	DH-FIN	Head - Finance	head.fin@mkpapermill.com	9000000015	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	15	\N	t	2026-06-29 21:39:19.003934	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
4	DH-RMS	Head - Raw Material Store	head.rms@mkpapermill.com	9000000002	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	2	\N	t	2026-07-11 15:09:41.172894	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
1	EMP001	Admin	admin@mkpapermill.com	9999999999	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	5	16	\N	t	2026-07-15 18:25:37.471097	2026-06-26 18:13:01.372505	2026-06-26 18:13:01.372505	f
20	DH-SCRAP	Head - Scrap Management	head.scrap@mkpapermill.com	9000000018	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	18	\N	t	2026-06-29 21:39:42.242803	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
19	DH-EHS	Head - EHS	head.ehs@mkpapermill.com	9000000017	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	17	\N	t	2026-06-29 21:39:43.025838	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
22	DH-FGW	Head - Finished Goods WH	head.fgw@mkpapermill.com	9000000020	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	20	\N	t	2026-06-29 21:47:18.92749	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
12	DH-DISP	Head - Dispatch	head.disp@mkpapermill.com	9000000010	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	10	\N	t	2026-06-29 21:42:25.469041	2026-06-29 09:48:42.952885	2026-06-29 12:50:21.521393	f
5	DH-INV	Head - Inventory	head.inv@mkpapermill.com	9000000003	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	3	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
7	DH-INDENT	Head - Indent Management	head.indent@mkpapermill.com	9000000005	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	5	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
8	DH-PUR	Head - Purchase	head.pur@mkpapermill.com	9000000006	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	6	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
9	DH-QC	Head - Quality	head.qc@mkpapermill.com	9000000007	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	7	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
13	DH-SALES	Head - Sales	head.sales@mkpapermill.com	9000000011	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	11	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
15	DH-SEC	Head - Security	head.sec@mkpapermill.com	9000000013	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	13	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
18	DH-ADMIN	Head - Administration	head.admin@mkpapermill.com	9000000016	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	16	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
23	STORE-DESK	Store Issue Desk	store@mkpapermill.com	9000000004	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	2	4	\N	t	\N	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
3	DH-PROD	Head - Production	head.prod@mkpapermill.com	9000000001	$2a$10$wrFIq3GeeXYwXrXLQvNxmuP/pWF9dFQroApSJRNu8OqYioaJ4F50m	3	1	\N	t	2026-07-06 11:28:52.485779	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
11	DH-UTIL	Head - Utility	head.util@mkpapermill.com	9000000009	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	9	\N	t	2026-07-08 12:53:16.080436	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
14	DH-HR	Head - HR & Payroll	head.hr@mkpapermill.com	9000000012	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	12	\N	t	2026-06-30 00:43:08.913652	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
10	DH-MAINT	Head - Maintenance	head.maint@mkpapermill.com	9000000008	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	8	\N	t	2026-06-30 00:43:42.699467	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
2	PH-001	Plant Head	planthead@mkpapermill.com	9000000099	$2a$10$XerIAWH99BPGBpQSa4TPlu2SoM/4I.DfBpSRtza8B/fHCKxIDY36u	4	16	\N	t	2026-06-29 21:48:53.38794	2026-06-29 09:48:42.952885	2026-07-10 19:40:06.471594	f
6	DH-STORE	Head - Store Management	head.store@mkpapermill.com	9000000004	$2a$10$DO/JKDwR5GqN6RIRyfmHWe.Gvp6t8mUWb.270.8xEXS2Amtjgen8y	3	4	\N	t	2026-08-11 21:50:35.614634	2026-06-29 09:48:42.952885	2026-06-29 09:48:42.952885	f
\.


--
-- Data for Name: utility_readings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.utility_readings (id, date, shift_type, reading_time, power_units, dg_units, steam_generated_mt, coal_consumed_kg, boiler_pressure, boiler_temp, fresh_water_kl, process_water_kl, air_pressure, etp_inlet_kl, etp_outlet_kl, recorded_by, created_at) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vendors (id, code, name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, payment_terms, credit_days, rating, is_active, created_at, deleted_by) FROM stdin;
1	TESTVEND1	Test Vendor Co	\N	\N	\N	\N	\N	\N	\N	9999999999	\N	\N	30	0.0	t	2026-07-10 19:59:04.165562	6
2	VND-0002	Global Scrap Co	\N	\N	123 Scrap Yard	\N	\N	\N	\N	\N	global@scrap.com	30 days	30	3.0	t	2026-07-10 23:54:50.226885	\N
\.


--
-- Name: adjustment_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.adjustment_requests_id_seq', 1, true);


--
-- Name: appraisal_competencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appraisal_competencies_id_seq', 1, false);


--
-- Name: appraisal_cycles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appraisal_cycles_id_seq', 1, false);


--
-- Name: appraisal_goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appraisal_goals_id_seq', 1, false);


--
-- Name: approval_matrix_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.approval_matrix_id_seq', 3, true);


--
-- Name: asset_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.asset_events_id_seq', 1, false);


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attendance_id_seq', 1, false);


--
-- Name: attendance_regularization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attendance_regularization_id_seq', 1, false);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 31, true);


--
-- Name: boiler_performance_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.boiler_performance_logs_id_seq', 2, true);


--
-- Name: chemical_consumption_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chemical_consumption_id_seq', 4, true);


--
-- Name: chemical_limit_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chemical_limit_alerts_id_seq', 2, true);


--
-- Name: clearance_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clearance_items_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 9, true);


--
-- Name: daily_production_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_production_reports_id_seq', 34, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.departments_id_seq', 20, true);


--
-- Name: dispatch_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dispatch_items_id_seq', 1, false);


--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dispatch_orders_id_seq', 1, false);


--
-- Name: downtime_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.downtime_entries_id_seq', 10, true);


--
-- Name: downtime_reason_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.downtime_reason_codes_id_seq', 10, true);


--
-- Name: dpr_chemical_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dpr_chemical_lines_id_seq', 22, true);


--
-- Name: dpr_downtime_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dpr_downtime_lines_id_seq', 10, true);


--
-- Name: dpr_grade_standards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dpr_grade_standards_id_seq', 8, true);


--
-- Name: dpr_gsm_breakup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dpr_gsm_breakup_id_seq', 89, true);


--
-- Name: ehs_incidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ehs_incidents_id_seq', 1, true);


--
-- Name: employee_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_documents_id_seq', 1, false);


--
-- Name: employee_leave_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_leave_balances_id_seq', 5, true);


--
-- Name: employee_leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_leave_types_id_seq', 16, true);


--
-- Name: employee_loans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_loans_id_seq', 1, false);


--
-- Name: employee_salary_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_salary_assignments_id_seq', 1, false);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 5, true);


--
-- Name: equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equipment_id_seq', 196, true);


--
-- Name: equipment_inspection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equipment_inspection_id_seq', 29, true);


--
-- Name: etp_readings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.etp_readings_id_seq', 1, false);


--
-- Name: furnish_mix_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.furnish_mix_log_id_seq', 6, true);


--
-- Name: gate_passes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gate_passes_id_seq', 1, false);


--
-- Name: grades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grades_id_seq', 5, true);


--
-- Name: grn_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grn_id_seq', 1, false);


--
-- Name: grn_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grn_items_id_seq', 1, false);


--
-- Name: holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.holidays_id_seq', 20, true);


--
-- Name: indent_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.indent_audit_log_id_seq', 1, false);


--
-- Name: indent_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.indent_comments_id_seq', 1, false);


--
-- Name: indent_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.indent_items_id_seq', 6, true);


--
-- Name: indents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.indents_id_seq', 7, true);


--
-- Name: inspection_round_scans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_round_scans_id_seq', 1, true);


--
-- Name: installed_assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.installed_assets_id_seq', 1, false);


--
-- Name: lab_samples_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lab_samples_id_seq', 1, false);


--
-- Name: leave_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_applications_id_seq', 1, true);


--
-- Name: machine_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_events_id_seq', 3, true);


--
-- Name: machine_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_positions_id_seq', 2, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machines_id_seq', 27, true);


--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maintenance_logs_id_seq', 1, true);


--
-- Name: maintenance_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maintenance_schedule_id_seq', 1, false);


--
-- Name: material_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.material_categories_id_seq', 38, true);


--
-- Name: materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.materials_id_seq', 3361, true);


--
-- Name: motor_electrical_specs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.motor_electrical_specs_id_seq', 332, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 3, true);


--
-- Name: onboarding_checklist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.onboarding_checklist_id_seq', 20, true);


--
-- Name: onboarding_tasks_master_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.onboarding_tasks_master_id_seq', 40, true);


--
-- Name: packing_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.packing_records_id_seq', 1, false);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 3, true);


--
-- Name: payroll_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payroll_details_id_seq', 1, false);


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payroll_runs_id_seq', 1, false);


--
-- Name: payrolls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payrolls_id_seq', 1, false);


--
-- Name: plant_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plant_sections_id_seq', 85, true);


--
-- Name: po_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.po_items_id_seq', 8, true);


--
-- Name: production_summary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.production_summary_id_seq', 1, false);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_orders_id_seq', 9, true);


--
-- Name: quality_lab_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quality_lab_tests_id_seq', 2, true);


--
-- Name: quality_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quality_tests_id_seq', 2, true);


--
-- Name: reels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reels_id_seq', 43, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- Name: salary_structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.salary_structures_id_seq', 10, true);


--
-- Name: sales_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_orders_id_seq', 2, true);


--
-- Name: scrap_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.scrap_records_id_seq', 1, true);


--
-- Name: section_alarms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_alarms_id_seq', 1, false);


--
-- Name: section_energy_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_energy_allocations_id_seq', 2, true);


--
-- Name: section_equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_equipment_id_seq', 43, true);


--
-- Name: section_kpi_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_kpi_snapshots_id_seq', 6920, true);


--
-- Name: section_process_readings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_process_readings_id_seq', 10, true);


--
-- Name: section_sops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.section_sops_id_seq', 1, false);


--
-- Name: sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sections_id_seq', 29, true);


--
-- Name: separation_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.separation_records_id_seq', 1, false);


--
-- Name: shift_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shift_reports_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shifts_id_seq', 3, true);


--
-- Name: stock_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_ledger_id_seq', 5, true);


--
-- Name: store_indent_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.store_indent_log_id_seq', 1, false);


--
-- Name: store_indents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.store_indents_id_seq', 1, false);


--
-- Name: store_issues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.store_issues_id_seq', 1, false);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 14, true);


--
-- Name: training_attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.training_attendance_id_seq', 1, false);


--
-- Name: training_programs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.training_programs_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 23, true);


--
-- Name: utility_readings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.utility_readings_id_seq', 3, true);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vendors_id_seq', 9, true);


--
-- Name: adjustment_requests adjustment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_requests
    ADD CONSTRAINT adjustment_requests_pkey PRIMARY KEY (id);


--
-- Name: appraisal_competencies appraisal_competencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_competencies
    ADD CONSTRAINT appraisal_competencies_pkey PRIMARY KEY (id);


--
-- Name: appraisal_cycles appraisal_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_cycles
    ADD CONSTRAINT appraisal_cycles_pkey PRIMARY KEY (id);


--
-- Name: appraisal_goals appraisal_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_goals
    ADD CONSTRAINT appraisal_goals_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix approval_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_pkey PRIMARY KEY (id);


--
-- Name: asset_events asset_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularization attendance_regularization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization
    ADD CONSTRAINT attendance_regularization_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: boiler_performance_logs boiler_performance_logs_log_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boiler_performance_logs
    ADD CONSTRAINT boiler_performance_logs_log_time_key UNIQUE (log_time);


--
-- Name: boiler_performance_logs boiler_performance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boiler_performance_logs
    ADD CONSTRAINT boiler_performance_logs_pkey PRIMARY KEY (id);


--
-- Name: chemical_consumption chemical_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_consumption
    ADD CONSTRAINT chemical_consumption_pkey PRIMARY KEY (id);


--
-- Name: chemical_limit_alerts chemical_limit_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_limit_alerts
    ADD CONSTRAINT chemical_limit_alerts_pkey PRIMARY KEY (id);


--
-- Name: clearance_items clearance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_items
    ADD CONSTRAINT clearance_items_pkey PRIMARY KEY (id);


--
-- Name: customers customers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_code_key UNIQUE (code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_production_reports daily_production_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports
    ADD CONSTRAINT daily_production_reports_pkey PRIMARY KEY (id);


--
-- Name: daily_production_reports daily_production_reports_report_date_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports
    ADD CONSTRAINT daily_production_reports_report_date_machine_id_key UNIQUE (report_date, machine_id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: dispatch_items dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_pkey PRIMARY KEY (id);


--
-- Name: dispatch_orders dispatch_orders_do_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_do_number_key UNIQUE (do_number);


--
-- Name: dispatch_orders dispatch_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_pkey PRIMARY KEY (id);


--
-- Name: downtime_entries downtime_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_pkey PRIMARY KEY (id);


--
-- Name: downtime_reason_codes downtime_reason_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_reason_codes
    ADD CONSTRAINT downtime_reason_codes_pkey PRIMARY KEY (id);


--
-- Name: downtime_reason_codes downtime_reason_codes_reason_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_reason_codes
    ADD CONSTRAINT downtime_reason_codes_reason_code_key UNIQUE (reason_code);


--
-- Name: dpr_chemical_lines dpr_chemical_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_chemical_lines
    ADD CONSTRAINT dpr_chemical_lines_pkey PRIMARY KEY (id);


--
-- Name: dpr_downtime_lines dpr_downtime_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_downtime_lines
    ADD CONSTRAINT dpr_downtime_lines_pkey PRIMARY KEY (id);


--
-- Name: dpr_grade_standards dpr_grade_standards_grade_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_grade_standards
    ADD CONSTRAINT dpr_grade_standards_grade_code_key UNIQUE (grade_code);


--
-- Name: dpr_grade_standards dpr_grade_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_grade_standards
    ADD CONSTRAINT dpr_grade_standards_pkey PRIMARY KEY (id);


--
-- Name: dpr_gsm_breakup dpr_gsm_breakup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_gsm_breakup
    ADD CONSTRAINT dpr_gsm_breakup_pkey PRIMARY KEY (id);


--
-- Name: ehs_incidents ehs_incidents_incident_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehs_incidents
    ADD CONSTRAINT ehs_incidents_incident_number_key UNIQUE (incident_number);


--
-- Name: ehs_incidents ehs_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehs_incidents
    ADD CONSTRAINT ehs_incidents_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_types employee_leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_types
    ADD CONSTRAINT employee_leave_types_code_key UNIQUE (code);


--
-- Name: employee_leave_types employee_leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_types
    ADD CONSTRAINT employee_leave_types_pkey PRIMARY KEY (id);


--
-- Name: employee_loans employee_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_pkey PRIMARY KEY (id);


--
-- Name: employee_salary_assignments employee_salary_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT employee_salary_assignments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_code_key UNIQUE (code);


--
-- Name: equipment_inspection equipment_inspection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_inspection
    ADD CONSTRAINT equipment_inspection_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: etp_readings etp_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etp_readings
    ADD CONSTRAINT etp_readings_pkey PRIMARY KEY (id);


--
-- Name: furnish_mix_log furnish_mix_log_batch_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furnish_mix_log
    ADD CONSTRAINT furnish_mix_log_batch_number_key UNIQUE (batch_number);


--
-- Name: furnish_mix_log furnish_mix_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furnish_mix_log
    ADD CONSTRAINT furnish_mix_log_pkey PRIMARY KEY (id);


--
-- Name: gate_passes gate_passes_gp_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_passes
    ADD CONSTRAINT gate_passes_gp_number_key UNIQUE (gp_number);


--
-- Name: gate_passes gate_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_passes
    ADD CONSTRAINT gate_passes_pkey PRIMARY KEY (id);


--
-- Name: grades grades_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_code_key UNIQUE (code);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: grn grn_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_grn_number_key UNIQUE (grn_number);


--
-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pkey PRIMARY KEY (id);


--
-- Name: grn grn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: indent_audit_log indent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_audit_log
    ADD CONSTRAINT indent_audit_log_pkey PRIMARY KEY (id);


--
-- Name: indent_comments indent_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_comments
    ADD CONSTRAINT indent_comments_pkey PRIMARY KEY (id);


--
-- Name: indent_items indent_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_pkey PRIMARY KEY (id);


--
-- Name: indents indents_indent_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_indent_number_key UNIQUE (indent_number);


--
-- Name: indents indents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_pkey PRIMARY KEY (id);


--
-- Name: inspection_round_scans inspection_round_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_round_scans
    ADD CONSTRAINT inspection_round_scans_pkey PRIMARY KEY (id);


--
-- Name: installed_assets installed_assets_asset_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_asset_number_key UNIQUE (asset_number);


--
-- Name: installed_assets installed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_pkey PRIMARY KEY (id);


--
-- Name: lab_samples lab_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT lab_samples_pkey PRIMARY KEY (id);


--
-- Name: lab_samples lab_samples_sample_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT lab_samples_sample_number_key UNIQUE (sample_number);


--
-- Name: leave_applications leave_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_pkey PRIMARY KEY (id);


--
-- Name: machine_events machine_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_pkey PRIMARY KEY (id);


--
-- Name: machine_positions machine_positions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_positions
    ADD CONSTRAINT machine_positions_code_key UNIQUE (code);


--
-- Name: machine_positions machine_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_positions
    ADD CONSTRAINT machine_positions_pkey PRIMARY KEY (id);


--
-- Name: machines machines_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_code_key UNIQUE (code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: maintenance_logs maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedule maintenance_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT maintenance_schedule_pkey PRIMARY KEY (id);


--
-- Name: material_categories material_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_code_key UNIQUE (code);


--
-- Name: material_categories material_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_name_key UNIQUE (name);


--
-- Name: material_categories material_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_pkey PRIMARY KEY (id);


--
-- Name: materials materials_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_code_key UNIQUE (code);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: motor_electrical_specs motor_electrical_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motor_electrical_specs
    ADD CONSTRAINT motor_electrical_specs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_checklist onboarding_checklist_employee_id_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_employee_id_task_id_key UNIQUE (employee_id, task_id);


--
-- Name: onboarding_checklist onboarding_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tasks_master onboarding_tasks_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks_master
    ADD CONSTRAINT onboarding_tasks_master_pkey PRIMARY KEY (id);


--
-- Name: packing_records packing_records_pack_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_records
    ADD CONSTRAINT packing_records_pack_number_key UNIQUE (pack_number);


--
-- Name: packing_records packing_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_records
    ADD CONSTRAINT packing_records_pkey PRIMARY KEY (id);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payroll_details payroll_details_payroll_run_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details
    ADD CONSTRAINT payroll_details_payroll_run_id_employee_id_key UNIQUE (payroll_run_id, employee_id);


--
-- Name: payroll_details payroll_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details
    ADD CONSTRAINT payroll_details_pkey PRIMARY KEY (id);


--
-- Name: payroll_runs payroll_runs_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_month_key UNIQUE (month);


--
-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: payrolls payrolls_employee_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_employee_id_month_key UNIQUE (employee_id, month);


--
-- Name: payrolls payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_pkey PRIMARY KEY (id);


--
-- Name: plant_sections plant_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_sections
    ADD CONSTRAINT plant_sections_pkey PRIMARY KEY (id);


--
-- Name: plant_sections plant_sections_section_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_sections
    ADD CONSTRAINT plant_sections_section_code_key UNIQUE (section_code);


--
-- Name: po_items po_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_pkey PRIMARY KEY (id);


--
-- Name: production_summary production_summary_date_shift_type_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_summary
    ADD CONSTRAINT production_summary_date_shift_type_machine_id_key UNIQUE (date, shift_type, machine_id);


--
-- Name: production_summary production_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_summary
    ADD CONSTRAINT production_summary_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: quality_lab_tests quality_lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests
    ADD CONSTRAINT quality_lab_tests_pkey PRIMARY KEY (id);


--
-- Name: quality_tests quality_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_pkey PRIMARY KEY (id);


--
-- Name: quality_tests quality_tests_test_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_test_number_key UNIQUE (test_number);


--
-- Name: reels reels_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_barcode_key UNIQUE (barcode);


--
-- Name: reels reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_pkey PRIMARY KEY (id);


--
-- Name: reels reels_reel_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_reel_number_key UNIQUE (reel_number);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salary_structures salary_structures_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT salary_structures_code_key UNIQUE (code);


--
-- Name: salary_structures salary_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT salary_structures_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_so_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_so_number_key UNIQUE (so_number);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: scrap_records scrap_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_pkey PRIMARY KEY (id);


--
-- Name: scrap_records scrap_records_scrap_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_scrap_number_key UNIQUE (scrap_number);


--
-- Name: section_alarms section_alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms
    ADD CONSTRAINT section_alarms_pkey PRIMARY KEY (id);


--
-- Name: section_energy_allocations section_energy_allocations_allocated_date_section_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_energy_allocations
    ADD CONSTRAINT section_energy_allocations_allocated_date_section_id_key UNIQUE (allocated_date, section_id);


--
-- Name: section_energy_allocations section_energy_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_energy_allocations
    ADD CONSTRAINT section_energy_allocations_pkey PRIMARY KEY (id);


--
-- Name: section_equipment section_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_equipment
    ADD CONSTRAINT section_equipment_pkey PRIMARY KEY (id);


--
-- Name: section_equipment section_equipment_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_equipment
    ADD CONSTRAINT section_equipment_tag_name_key UNIQUE (tag_name);


--
-- Name: section_kpi_snapshots section_kpi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_kpi_snapshots
    ADD CONSTRAINT section_kpi_snapshots_pkey PRIMARY KEY (id);


--
-- Name: section_process_readings section_process_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings
    ADD CONSTRAINT section_process_readings_pkey PRIMARY KEY (id);


--
-- Name: section_sops section_sops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_sops
    ADD CONSTRAINT section_sops_pkey PRIMARY KEY (id);


--
-- Name: sections sections_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_code_key UNIQUE (code);


--
-- Name: sections sections_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_name_key UNIQUE (name);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: separation_records separation_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records
    ADD CONSTRAINT separation_records_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: shift_reports shift_reports_date_shift_type_section_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_reports
    ADD CONSTRAINT shift_reports_date_shift_type_section_key UNIQUE (date, shift_type, section);


--
-- Name: shift_reports shift_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_reports
    ADD CONSTRAINT shift_reports_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: store_indent_log store_indent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indent_log
    ADD CONSTRAINT store_indent_log_pkey PRIMARY KEY (id);


--
-- Name: store_indents store_indents_indent_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_indent_number_key UNIQUE (indent_number);


--
-- Name: store_indents store_indents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_pkey PRIMARY KEY (id);


--
-- Name: store_issues store_issues_issue_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_issue_number_key UNIQUE (issue_number);


--
-- Name: store_issues store_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: training_attendance training_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_pkey PRIMARY KEY (id);


--
-- Name: training_attendance training_attendance_training_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_training_id_employee_id_key UNIQUE (training_id, employee_id);


--
-- Name: training_programs training_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_code_key UNIQUE (employee_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: utility_readings utility_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_readings
    ADD CONSTRAINT utility_readings_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_code_key UNIQUE (code);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_alarms_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alarms_active ON public.section_alarms USING btree (section_id, resolved_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_alarms_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alarms_section ON public.section_alarms USING btree (section_id, triggered_at DESC);


--
-- Name: idx_appr_goals_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appr_goals_emp ON public.appraisal_goals USING btree (employee_id, cycle_id);


--
-- Name: idx_att_reg_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_reg_emp ON public.attendance_regularization USING btree (employee_id, attendance_date);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (date);


--
-- Name: idx_attendance_emp_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_emp_date ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_audit_log_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_module ON public.audit_log USING btree (module, created_at);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_dpr_chem_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpr_chem_report ON public.dpr_chemical_lines USING btree (report_id);


--
-- Name: idx_dpr_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpr_date ON public.daily_production_reports USING btree (report_date DESC);


--
-- Name: idx_dpr_dt_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpr_dt_report ON public.dpr_downtime_lines USING btree (report_id);


--
-- Name: idx_dpr_gsm_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpr_gsm_report ON public.dpr_gsm_breakup USING btree (report_id);


--
-- Name: idx_emp_docs_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_docs_emp ON public.employee_documents USING btree (employee_id, doc_type);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_furnish_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_furnish_date ON public.furnish_mix_log USING btree (report_date, machine_id);


--
-- Name: idx_indent_items_ack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_items_ack ON public.indent_items USING btree (ack_status);


--
-- Name: idx_indent_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_log_created ON public.store_indent_log USING btree (created_at);


--
-- Name: idx_indent_log_indent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_log_indent ON public.store_indent_log USING btree (indent_id);


--
-- Name: idx_indents_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indents_date ON public.indents USING btree (date);


--
-- Name: idx_indents_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indents_dept ON public.indents USING btree (department_id);


--
-- Name: idx_indents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indents_status ON public.indents USING btree (status);


--
-- Name: idx_kpi_section_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_kpi_section_hour ON public.section_kpi_snapshots USING btree (section_id, date_trunc('hour'::text, snapshot_time));


--
-- Name: idx_leave_app_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_app_emp ON public.leave_applications USING btree (employee_id, from_date);


--
-- Name: idx_leave_app_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_app_status ON public.leave_applications USING btree (status);


--
-- Name: idx_leave_bal_emp_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_bal_emp_year ON public.employee_leave_balances USING btree (employee_id, year);


--
-- Name: idx_me_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_me_equipment ON public.machine_events USING btree (equipment_id, event_time DESC);


--
-- Name: idx_me_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_me_event_type ON public.machine_events USING btree (event_type, severity);


--
-- Name: idx_me_section_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_me_section_time ON public.machine_events USING btree (section_id, event_time DESC);


--
-- Name: idx_motor_specs_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_motor_specs_section ON public.motor_electrical_specs USING btree (section_label);


--
-- Name: idx_notif_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_onboard_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboard_emp ON public.onboarding_checklist USING btree (employee_id);


--
-- Name: idx_payroll_det_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_det_emp ON public.payroll_details USING btree (employee_id, payroll_run_id);


--
-- Name: idx_payrolls_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payrolls_employee_id ON public.payrolls USING btree (employee_id);


--
-- Name: idx_qlt_reel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qlt_reel ON public.quality_lab_tests USING btree (reel_id);


--
-- Name: idx_qlt_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qlt_section ON public.quality_lab_tests USING btree (section_id, test_time DESC);


--
-- Name: idx_qlt_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qlt_shift ON public.quality_lab_tests USING btree (shift_id, test_time DESC);


--
-- Name: idx_reels_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reels_date ON public.reels USING btree (start_time);


--
-- Name: idx_reels_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reels_machine ON public.reels USING btree (machine_id);


--
-- Name: idx_reels_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reels_shift ON public.reels USING btree (shift_id);


--
-- Name: idx_reels_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reels_status ON public.reels USING btree (status);


--
-- Name: idx_round_scans_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_round_scans_section ON public.inspection_round_scans USING btree (section_id, check_date);


--
-- Name: idx_sal_assign_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sal_assign_emp ON public.employee_salary_assignments USING btree (employee_id, effective_from);


--
-- Name: idx_sep_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sep_emp ON public.separation_records USING btree (employee_id);


--
-- Name: idx_spr_section_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spr_section_time ON public.section_process_readings USING btree (section_id, reading_time DESC);


--
-- Name: idx_spr_tag_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spr_tag_time ON public.section_process_readings USING btree (tag_name, reading_time DESC);


--
-- Name: idx_stock_ledger_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_ledger_date ON public.stock_ledger USING btree (date);


--
-- Name: idx_stock_ledger_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_ledger_material ON public.stock_ledger USING btree (material_id);


--
-- Name: idx_stock_ledger_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_ledger_shift ON public.stock_ledger USING btree (shift, date);


--
-- Name: idx_store_indents_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_indents_date ON public.store_indents USING btree (indent_date);


--
-- Name: idx_store_indents_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_indents_dept ON public.store_indents USING btree (department_id);


--
-- Name: idx_store_indents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_indents_status ON public.store_indents USING btree (status);


--
-- Name: idx_training_att_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_att_emp ON public.training_attendance USING btree (employee_id);


--
-- Name: idx_utility_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utility_date ON public.utility_readings USING btree (date);


--
-- Name: uq_holidays_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_holidays_date ON public.holidays USING btree (holiday_date);


--
-- Name: adjustment_requests adjustment_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_requests
    ADD CONSTRAINT adjustment_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: adjustment_requests adjustment_requests_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_requests
    ADD CONSTRAINT adjustment_requests_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: adjustment_requests adjustment_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adjustment_requests
    ADD CONSTRAINT adjustment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: appraisal_competencies appraisal_competencies_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_competencies
    ADD CONSTRAINT appraisal_competencies_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.appraisal_cycles(id) ON DELETE CASCADE;


--
-- Name: appraisal_competencies appraisal_competencies_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_competencies
    ADD CONSTRAINT appraisal_competencies_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: appraisal_cycles appraisal_cycles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_cycles
    ADD CONSTRAINT appraisal_cycles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: appraisal_goals appraisal_goals_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_goals
    ADD CONSTRAINT appraisal_goals_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.appraisal_cycles(id) ON DELETE CASCADE;


--
-- Name: appraisal_goals appraisal_goals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_goals
    ADD CONSTRAINT appraisal_goals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: appraisal_goals appraisal_goals_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_goals
    ADD CONSTRAINT appraisal_goals_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: asset_events asset_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.installed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_events asset_events_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_events
    ADD CONSTRAINT asset_events_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: attendance_regularization attendance_regularization_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization
    ADD CONSTRAINT attendance_regularization_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: attendance_regularization attendance_regularization_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization
    ADD CONSTRAINT attendance_regularization_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: boiler_performance_logs boiler_performance_logs_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boiler_performance_logs
    ADD CONSTRAINT boiler_performance_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id);


--
-- Name: chemical_consumption chemical_consumption_chemical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_consumption
    ADD CONSTRAINT chemical_consumption_chemical_id_fkey FOREIGN KEY (chemical_id) REFERENCES public.materials(id);


--
-- Name: chemical_consumption chemical_consumption_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_consumption
    ADD CONSTRAINT chemical_consumption_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: chemical_limit_alerts chemical_limit_alerts_chemical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemical_limit_alerts
    ADD CONSTRAINT chemical_limit_alerts_chemical_id_fkey FOREIGN KEY (chemical_id) REFERENCES public.materials(id);


--
-- Name: clearance_items clearance_items_cleared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_items
    ADD CONSTRAINT clearance_items_cleared_by_fkey FOREIGN KEY (cleared_by) REFERENCES public.users(id);


--
-- Name: clearance_items clearance_items_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_items
    ADD CONSTRAINT clearance_items_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: clearance_items clearance_items_separation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clearance_items
    ADD CONSTRAINT clearance_items_separation_id_fkey FOREIGN KEY (separation_id) REFERENCES public.separation_records(id) ON DELETE CASCADE;


--
-- Name: customers customers_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: daily_production_reports daily_production_reports_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports
    ADD CONSTRAINT daily_production_reports_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: daily_production_reports daily_production_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports
    ADD CONSTRAINT daily_production_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: daily_production_reports daily_production_reports_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production_reports
    ADD CONSTRAINT daily_production_reports_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: dispatch_items dispatch_items_dispatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_dispatch_id_fkey FOREIGN KEY (dispatch_id) REFERENCES public.dispatch_orders(id) ON DELETE CASCADE;


--
-- Name: dispatch_items dispatch_items_reel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id);


--
-- Name: dispatch_orders dispatch_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: dispatch_orders dispatch_orders_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: dispatch_orders dispatch_orders_so_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id);


--
-- Name: downtime_entries downtime_entries_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: downtime_entries downtime_entries_reason_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_reason_code_id_fkey FOREIGN KEY (reason_code_id) REFERENCES public.downtime_reason_codes(id);


--
-- Name: downtime_entries downtime_entries_reel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id);


--
-- Name: downtime_entries downtime_entries_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: downtime_entries downtime_entries_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: dpr_chemical_lines dpr_chemical_lines_chemical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_chemical_lines
    ADD CONSTRAINT dpr_chemical_lines_chemical_id_fkey FOREIGN KEY (chemical_id) REFERENCES public.materials(id);


--
-- Name: dpr_chemical_lines dpr_chemical_lines_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_chemical_lines
    ADD CONSTRAINT dpr_chemical_lines_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_production_reports(id) ON DELETE CASCADE;


--
-- Name: dpr_downtime_lines dpr_downtime_lines_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_downtime_lines
    ADD CONSTRAINT dpr_downtime_lines_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_production_reports(id) ON DELETE CASCADE;


--
-- Name: dpr_gsm_breakup dpr_gsm_breakup_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpr_gsm_breakup
    ADD CONSTRAINT dpr_gsm_breakup_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_production_reports(id) ON DELETE CASCADE;


--
-- Name: ehs_incidents ehs_incidents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehs_incidents
    ADD CONSTRAINT ehs_incidents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: ehs_incidents ehs_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehs_incidents
    ADD CONSTRAINT ehs_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.employee_leave_types(id);


--
-- Name: employee_loans employee_loans_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: employee_loans employee_loans_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_salary_assignments employee_salary_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT employee_salary_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: employee_salary_assignments employee_salary_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT employee_salary_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_salary_assignments employee_salary_assignments_salary_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT employee_salary_assignments_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES public.salary_structures(id);


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_reporting_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_to_fkey FOREIGN KEY (reporting_to) REFERENCES public.employees(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: equipment_inspection equipment_inspection_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_inspection
    ADD CONSTRAINT equipment_inspection_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_inspection equipment_inspection_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_inspection
    ADD CONSTRAINT equipment_inspection_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.users(id);


--
-- Name: equipment equipment_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- Name: etp_readings etp_readings_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etp_readings
    ADD CONSTRAINT etp_readings_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id);


--
-- Name: furnish_mix_log furnish_mix_log_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furnish_mix_log
    ADD CONSTRAINT furnish_mix_log_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: furnish_mix_log furnish_mix_log_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furnish_mix_log
    ADD CONSTRAINT furnish_mix_log_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);


--
-- Name: gate_passes gate_passes_security_guard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_passes
    ADD CONSTRAINT gate_passes_security_guard_id_fkey FOREIGN KEY (security_guard_id) REFERENCES public.users(id);


--
-- Name: grades grades_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: grn_items grn_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn(id) ON DELETE CASCADE;


--
-- Name: grn_items grn_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: grn grn_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: grn grn_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: indent_audit_log indent_audit_log_indent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_audit_log
    ADD CONSTRAINT indent_audit_log_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id);


--
-- Name: indent_audit_log indent_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_audit_log
    ADD CONSTRAINT indent_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: indent_comments indent_comments_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_comments
    ADD CONSTRAINT indent_comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.store_issues(id) ON DELETE CASCADE;


--
-- Name: indent_comments indent_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_comments
    ADD CONSTRAINT indent_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: indent_items indent_items_ack_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_ack_by_fkey FOREIGN KEY (ack_by) REFERENCES public.users(id);


--
-- Name: indent_items indent_items_indent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id) ON DELETE CASCADE;


--
-- Name: indent_items indent_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: indents indents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: indents indents_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: indents indents_l1_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_l1_approved_by_fkey FOREIGN KEY (l1_approved_by) REFERENCES public.users(id);


--
-- Name: indents indents_l2_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_l2_approved_by_fkey FOREIGN KEY (l2_approved_by) REFERENCES public.users(id);


--
-- Name: indents indents_l3_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_l3_approved_by_fkey FOREIGN KEY (l3_approved_by) REFERENCES public.users(id);


--
-- Name: indents indents_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: indents indents_raised_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.users(id);


--
-- Name: indents indents_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: inspection_round_scans inspection_round_scans_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_round_scans
    ADD CONSTRAINT inspection_round_scans_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- Name: inspection_round_scans inspection_round_scans_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_round_scans
    ADD CONSTRAINT inspection_round_scans_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: installed_assets installed_assets_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: installed_assets installed_assets_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: installed_assets installed_assets_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE RESTRICT;


--
-- Name: installed_assets installed_assets_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: installed_assets installed_assets_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.machine_positions(id) ON DELETE RESTRICT;


--
-- Name: installed_assets installed_assets_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_assets
    ADD CONSTRAINT installed_assets_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: lab_samples lab_samples_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT lab_samples_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id);


--
-- Name: lab_samples lab_samples_tested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT lab_samples_tested_by_fkey FOREIGN KEY (tested_by) REFERENCES public.users(id);


--
-- Name: leave_applications leave_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: leave_applications leave_applications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_applications leave_applications_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.employee_leave_types(id);


--
-- Name: machine_events machine_events_alarm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_alarm_id_fkey FOREIGN KEY (alarm_id) REFERENCES public.section_alarms(id);


--
-- Name: machine_events machine_events_downtime_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_downtime_entry_id_fkey FOREIGN KEY (downtime_entry_id) REFERENCES public.downtime_entries(id);


--
-- Name: machine_events machine_events_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.section_equipment(id);


--
-- Name: machine_events machine_events_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: machine_events machine_events_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: machine_events machine_events_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_events
    ADD CONSTRAINT machine_events_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: machine_positions machine_positions_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_positions
    ADD CONSTRAINT machine_positions_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: machines machines_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: maintenance_logs maintenance_logs_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: maintenance_logs maintenance_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: maintenance_logs maintenance_logs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.maintenance_schedule(id);


--
-- Name: maintenance_schedule maintenance_schedule_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT maintenance_schedule_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: maintenance_schedule maintenance_schedule_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT maintenance_schedule_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: maintenance_schedule maintenance_schedule_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT maintenance_schedule_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.machine_positions(id);


--
-- Name: materials materials_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.material_categories(id);


--
-- Name: materials materials_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: onboarding_checklist onboarding_checklist_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: onboarding_checklist onboarding_checklist_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: onboarding_checklist onboarding_checklist_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.onboarding_tasks_master(id);


--
-- Name: packing_records packing_records_packed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_records
    ADD CONSTRAINT packing_records_packed_by_fkey FOREIGN KEY (packed_by) REFERENCES public.users(id);


--
-- Name: packing_records packing_records_reel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_records
    ADD CONSTRAINT packing_records_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id);


--
-- Name: payments payments_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id);


--
-- Name: payments payments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: payments payments_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE RESTRICT;


--
-- Name: payroll_details payroll_details_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details
    ADD CONSTRAINT payroll_details_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_details payroll_details_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details
    ADD CONSTRAINT payroll_details_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;


--
-- Name: payroll_details payroll_details_salary_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_details
    ADD CONSTRAINT payroll_details_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES public.salary_structures(id);


--
-- Name: payroll_runs payroll_runs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: payroll_runs payroll_runs_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);


--
-- Name: payroll_runs payroll_runs_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: payrolls payrolls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payrolls payrolls_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: plant_sections plant_sections_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_sections
    ADD CONSTRAINT plant_sections_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: po_items po_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: po_items po_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: production_summary production_summary_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_summary
    ADD CONSTRAINT production_summary_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: quality_lab_tests quality_lab_tests_lab_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests
    ADD CONSTRAINT quality_lab_tests_lab_by_fkey FOREIGN KEY (lab_by) REFERENCES public.users(id);


--
-- Name: quality_lab_tests quality_lab_tests_reel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests
    ADD CONSTRAINT quality_lab_tests_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE SET NULL;


--
-- Name: quality_lab_tests quality_lab_tests_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests
    ADD CONSTRAINT quality_lab_tests_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: quality_lab_tests quality_lab_tests_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_lab_tests
    ADD CONSTRAINT quality_lab_tests_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: quality_tests quality_tests_tested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_tested_by_fkey FOREIGN KEY (tested_by) REFERENCES public.users(id);


--
-- Name: reels reels_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: reels reels_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: reels reels_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: reels reels_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: sales_orders sales_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_orders sales_orders_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: scrap_records scrap_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: scrap_records scrap_records_source_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrap_records
    ADD CONSTRAINT scrap_records_source_department_id_fkey FOREIGN KEY (source_department_id) REFERENCES public.departments(id);


--
-- Name: section_alarms section_alarms_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms
    ADD CONSTRAINT section_alarms_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: section_alarms section_alarms_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms
    ADD CONSTRAINT section_alarms_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.section_equipment(id);


--
-- Name: section_alarms section_alarms_maintenance_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms
    ADD CONSTRAINT section_alarms_maintenance_log_id_fkey FOREIGN KEY (maintenance_log_id) REFERENCES public.maintenance_logs(id);


--
-- Name: section_alarms section_alarms_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_alarms
    ADD CONSTRAINT section_alarms_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: section_energy_allocations section_energy_allocations_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_energy_allocations
    ADD CONSTRAINT section_energy_allocations_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- Name: section_equipment section_equipment_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_equipment
    ADD CONSTRAINT section_equipment_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: section_equipment section_equipment_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_equipment
    ADD CONSTRAINT section_equipment_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: section_kpi_snapshots section_kpi_snapshots_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_kpi_snapshots
    ADD CONSTRAINT section_kpi_snapshots_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: section_process_readings section_process_readings_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings
    ADD CONSTRAINT section_process_readings_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.section_equipment(id);


--
-- Name: section_process_readings section_process_readings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings
    ADD CONSTRAINT section_process_readings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: section_process_readings section_process_readings_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings
    ADD CONSTRAINT section_process_readings_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: section_process_readings section_process_readings_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_process_readings
    ADD CONSTRAINT section_process_readings_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: section_sops section_sops_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_sops
    ADD CONSTRAINT section_sops_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: section_sops section_sops_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_sops
    ADD CONSTRAINT section_sops_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.plant_sections(id);


--
-- Name: sections sections_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: separation_records separation_records_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records
    ADD CONSTRAINT separation_records_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: separation_records separation_records_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records
    ADD CONSTRAINT separation_records_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: separation_records separation_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records
    ADD CONSTRAINT separation_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: separation_records separation_records_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.separation_records
    ADD CONSTRAINT separation_records_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shift_reports shift_reports_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_reports
    ADD CONSTRAINT shift_reports_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: shifts shifts_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: shifts shifts_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: stock_ledger stock_ledger_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_ledger stock_ledger_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: store_indent_log store_indent_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indent_log
    ADD CONSTRAINT store_indent_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: store_indent_log store_indent_log_indent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indent_log
    ADD CONSTRAINT store_indent_log_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.store_indents(id) ON DELETE CASCADE;


--
-- Name: store_indents store_indents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: store_indents store_indents_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: store_indents store_indents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: store_indents store_indents_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: store_indents store_indents_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: store_indents store_indents_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_indents
    ADD CONSTRAINT store_indents_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: store_issues store_issues_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: store_issues store_issues_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: store_issues store_issues_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: store_issues store_issues_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: store_issues store_issues_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE SET NULL;


--
-- Name: store_issues store_issues_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: store_issues store_issues_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.machine_positions(id) ON DELETE SET NULL;


--
-- Name: store_issues store_issues_substitute_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_issues
    ADD CONSTRAINT store_issues_substitute_material_id_fkey FOREIGN KEY (substitute_material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: training_attendance training_attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: training_attendance training_attendance_nominated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_nominated_by_fkey FOREIGN KEY (nominated_by) REFERENCES public.users(id);


--
-- Name: training_attendance training_attendance_training_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_training_id_fkey FOREIGN KEY (training_id) REFERENCES public.training_programs(id) ON DELETE CASCADE;


--
-- Name: training_programs training_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: utility_readings utility_readings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_readings
    ADD CONSTRAINT utility_readings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: vendors vendors_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict rXGnN2ovn95Qq2zbYVQ7Mvr650gTn1ZjhiXXaoVWITBlCaeI1hsJ5ubVtYYQTK6


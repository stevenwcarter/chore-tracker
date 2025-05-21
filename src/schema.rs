// @generated automatically by Diesel CLI.

diesel::table! {
    admins (id) {
        id -> Nullable<Integer>,
        uuid -> Text,
        name -> Text,
        email -> Text,
        oidc_subject -> Text,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    chore_assignments (id) {
        id -> Nullable<Integer>,
        chore_id -> Integer,
        user_id -> Integer,
        created_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    chore_completion_notes (id) {
        id -> Nullable<Integer>,
        uuid -> Text,
        chore_completion_id -> Integer,
        author_type -> Text,
        author_user_id -> Nullable<Integer>,
        author_admin_id -> Nullable<Integer>,
        note_text -> Text,
        visible_to_user -> Bool,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    chore_completions (id) {
        id -> Nullable<Integer>,
        uuid -> Text,
        chore_id -> Integer,
        user_id -> Integer,
        completed_date -> Date,
        amount_cents -> Integer,
        approved -> Bool,
        approved_by_admin_id -> Nullable<Integer>,
        approved_at -> Nullable<Timestamp>,
        paid_out -> Bool,
        paid_out_at -> Nullable<Timestamp>,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    chores (id) {
        id -> Nullable<Integer>,
        uuid -> Text,
        name -> Text,
        description -> Nullable<Text>,
        payment_type -> Text,
        amount_cents -> Integer,
        required_days -> Integer,
        active -> Bool,
        created_by_admin_id -> Integer,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    keys (uuid) {
        uuid -> Text,
        name -> Text,
        email -> Text,
        blocked -> Bool,
        expiration -> Integer,
        limits -> Text,
        notes -> Text,
    }
}

diesel::table! {
    limit_usage (uuid, window, duration) {
        uuid -> Text,
        window -> Integer,
        duration -> Integer,
        usage -> Integer,
        usage_limit -> Integer,
    }
}

diesel::table! {
    user_images (id) {
        id -> Integer,
        user_id -> Integer,
        image_data -> Binary,
        content_type -> Text,
        file_size -> Integer,
        created_at -> Timestamp,
    }
}

diesel::table! {
    users (id) {
        id -> Nullable<Integer>,
        uuid -> Text,
        name -> Text,
        image_path -> Nullable<Text>,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
        image_id -> Nullable<Integer>,
    }
}

diesel::joinable!(chore_assignments -> chores (chore_id));
diesel::joinable!(chore_assignments -> users (user_id));
diesel::joinable!(chore_completion_notes -> admins (author_admin_id));
diesel::joinable!(chore_completion_notes -> chore_completions (chore_completion_id));
diesel::joinable!(chore_completion_notes -> users (author_user_id));
diesel::joinable!(chore_completions -> admins (approved_by_admin_id));
diesel::joinable!(chore_completions -> chores (chore_id));
diesel::joinable!(chore_completions -> users (user_id));
diesel::joinable!(chores -> admins (created_by_admin_id));

diesel::allow_tables_to_appear_in_same_query!(
    admins,
    chore_assignments,
    chore_completion_notes,
    chore_completions,
    chores,
    keys,
    limit_usage,
    user_images,
    users,
);

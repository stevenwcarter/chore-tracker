// @generated automatically by Diesel CLI.

diesel::table! {
    admin_sessions (id) {
        id -> Nullable<Integer>,
        session_token -> Text,
        admin_id -> Integer,
        created_at -> Timestamp,
        expires_at -> Timestamp,
    }
}

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
        bonus_date -> Nullable<Date>,
        max_claims -> Nullable<Integer>,
    }
}

diesel::table! {
    user_badges (id) {
        id -> Integer,
        user_id -> Integer,
        badge_type -> Text,
        earned_at -> Timestamp,
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
        uuid -> Nullable<Text>,
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

diesel::joinable!(admin_sessions -> admins (admin_id));
diesel::joinable!(chore_assignments -> chores (chore_id));
diesel::joinable!(chore_assignments -> users (user_id));
diesel::joinable!(chore_completion_notes -> admins (author_admin_id));
diesel::joinable!(chore_completion_notes -> chore_completions (chore_completion_id));
diesel::joinable!(chore_completion_notes -> users (author_user_id));
diesel::joinable!(chore_completions -> admins (approved_by_admin_id));
diesel::joinable!(chore_completions -> chores (chore_id));
diesel::joinable!(chore_completions -> users (user_id));
diesel::joinable!(chores -> admins (created_by_admin_id));
diesel::joinable!(user_badges -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    admin_sessions,
    admins,
    chore_assignments,
    chore_completion_notes,
    chore_completions,
    chores,
    user_badges,
    user_images,
    users,
);

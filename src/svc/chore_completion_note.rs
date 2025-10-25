use crate::{
    context::GraphQLContext, 
    db::get_conn, 
    models::ChoreCompletionNote, 
    schema::chore_completion_notes
};
use anyhow::{Context, Result};
use diesel::prelude::*;

pub struct ChoreCompletionNoteSvc {}

impl ChoreCompletionNoteSvc {
    pub fn get(context: &GraphQLContext, note_uuid: &str) -> Result<ChoreCompletionNote> {
        chore_completion_notes::table
            .filter(chore_completion_notes::uuid.eq(note_uuid))
            .select(ChoreCompletionNote::as_select())
            .first(&mut get_conn(context))
            .context("Could not find chore completion note")
    }

    pub fn list_for_completion(
        context: &GraphQLContext,
        completion_id: i32,
        visible_to_user_only: bool,
    ) -> Result<Vec<ChoreCompletionNote>> {
        let mut query = chore_completion_notes::table
            .filter(chore_completion_notes::chore_completion_id.eq(completion_id))
            .into_boxed();

        if visible_to_user_only {
            query = query.filter(chore_completion_notes::visible_to_user.eq(true));
        }

        query
            .select(ChoreCompletionNote::as_select())
            .order_by(chore_completion_notes::created_at.asc())
            .load::<ChoreCompletionNote>(&mut get_conn(context))
            .context("Could not load chore completion notes")
    }

    pub fn create(context: &GraphQLContext, note: &ChoreCompletionNote) -> Result<ChoreCompletionNote> {
        diesel::insert_into(chore_completion_notes::table)
            .values(note)
            .execute(&mut get_conn(context))
            .context("Could not create chore completion note")?;

        Self::get(context, &note.uuid)
    }

    pub fn update(context: &GraphQLContext, note: &ChoreCompletionNote) -> Result<ChoreCompletionNote> {
        diesel::update(chore_completion_notes::table)
            .filter(chore_completion_notes::uuid.eq(&note.uuid))
            .set(note)
            .execute(&mut get_conn(context))
            .context("Could not update chore completion note")?;

        Self::get(context, &note.uuid)
    }

    pub fn delete(context: &GraphQLContext, note_uuid: &str) -> Result<()> {
        diesel::delete(chore_completion_notes::table)
            .filter(chore_completion_notes::uuid.eq(note_uuid))
            .execute(&mut get_conn(context))
            .context("Could not delete chore completion note")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{AuthorType, ChoreCompletionInput, ChoreCompletionNoteInput, PaymentType},
        svc::ChoreCompletionSvc,
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_chore_assignment, create_test_context,
            create_test_date, create_test_user, day_patterns,
        },
    };

    fn create_test_completion(
        context: &GraphQLContext,
        chore_id: i32,
        user_id: i32,
    ) -> crate::models::ChoreCompletion {
        let input = ChoreCompletionInput {
            uuid: None,
            chore_id,
            user_id,
            completed_date: create_test_date(2024, 10, 21),
        };
        ChoreCompletionSvc::create(context, &input).unwrap()
    }

    #[test]
    fn test_note_crud_operations() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());
        let completion = create_test_completion(&context, chore.id.unwrap(), user.id.unwrap());

        // Test creating a user note
        let user_note_input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion.id.unwrap(),
            author_type: AuthorType::User,
            author_user_id: Some(user.id.unwrap()),
            author_admin_id: None,
            note_text: "I completed this task!".to_string(),
            visible_to_user: Some(true),
        };

        let user_note = ChoreCompletionNote::from(user_note_input);
        let created_note = ChoreCompletionNoteSvc::create(&context, &user_note).unwrap();

        assert_eq!(created_note.note_text, "I completed this task!");
        assert_eq!(created_note.author_type, "user");
        assert_eq!(created_note.author_user_id, Some(user.id.unwrap()));
        assert_eq!(created_note.author_admin_id, None);
        assert!(created_note.visible_to_user);

        // Test get by UUID
        let retrieved = ChoreCompletionNoteSvc::get(&context, &created_note.uuid).unwrap();
        assert_eq!(retrieved.uuid, created_note.uuid);

        // Test creating an admin note (visible to users)
        let admin_note_input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion.id.unwrap(),
            author_type: AuthorType::Admin,
            author_user_id: None,
            author_admin_id: Some(admin.id.unwrap()),
            note_text: "Good job!".to_string(),
            visible_to_user: Some(true),
        };

        let admin_note = ChoreCompletionNote::from(admin_note_input);
        let created_admin_note = ChoreCompletionNoteSvc::create(&context, &admin_note).unwrap();

        assert_eq!(created_admin_note.note_text, "Good job!");
        assert_eq!(created_admin_note.author_type, "admin");
        assert!(created_admin_note.visible_to_user);

        // Test creating an admin-only note (not visible to users)
        let admin_private_note_input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion.id.unwrap(),
            author_type: AuthorType::Admin,
            author_user_id: None,
            author_admin_id: Some(admin.id.unwrap()),
            note_text: "Internal admin note".to_string(),
            visible_to_user: Some(false),
        };

        let admin_private_note = ChoreCompletionNote::from(admin_private_note_input);
        let created_private_note = ChoreCompletionNoteSvc::create(&context, &admin_private_note).unwrap();

        assert!(!created_private_note.visible_to_user);

        // Test update
        let updated_note = ChoreCompletionNote {
            id: created_note.id,
            uuid: created_note.uuid.clone(),
            chore_completion_id: created_note.chore_completion_id,
            author_type: created_note.author_type.clone(),
            author_user_id: created_note.author_user_id,
            author_admin_id: created_note.author_admin_id,
            note_text: "Updated note text".to_string(),
            visible_to_user: created_note.visible_to_user,
            created_at: created_note.created_at,
            updated_at: created_note.updated_at,
        };

        let result = ChoreCompletionNoteSvc::update(&context, &updated_note).unwrap();
        assert_eq!(result.note_text, "Updated note text");

        // Test deletion
        ChoreCompletionNoteSvc::delete(&context, &created_note.uuid).unwrap();
        let deleted_result = ChoreCompletionNoteSvc::get(&context, &created_note.uuid);
        assert!(deleted_result.is_err());
    }

    #[test]
    fn test_list_notes_for_completion() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());
        let completion = create_test_completion(&context, chore.id.unwrap(), user.id.unwrap());

        // Create different types of notes
        let notes_data = [
            ("User note", AuthorType::User, Some(user.id.unwrap()), None, true),
            ("Admin public note", AuthorType::Admin, None, Some(admin.id.unwrap()), true),
            ("Admin private note", AuthorType::Admin, None, Some(admin.id.unwrap()), false),
            ("Another user note", AuthorType::User, Some(user.id.unwrap()), None, true),
        ];

        for (text, author_type, author_user_id, author_admin_id, visible) in notes_data {
            let note_input = ChoreCompletionNoteInput {
                uuid: None,
                chore_completion_id: completion.id.unwrap(),
                author_type,
                author_user_id,
                author_admin_id,
                note_text: text.to_string(),
                visible_to_user: Some(visible),
            };

            let note = ChoreCompletionNote::from(note_input);
            ChoreCompletionNoteSvc::create(&context, &note).unwrap();
        }

        // Test listing all notes (admin view)
        let all_notes = ChoreCompletionNoteSvc::list_for_completion(
            &context,
            completion.id.unwrap(),
            false,
        ).unwrap();
        assert_eq!(all_notes.len(), 4);

        // Test listing only user-visible notes
        let user_visible_notes = ChoreCompletionNoteSvc::list_for_completion(
            &context,
            completion.id.unwrap(),
            true,
        ).unwrap();
        assert_eq!(user_visible_notes.len(), 3); // Excludes the private admin note
        assert!(user_visible_notes.iter().all(|note| note.visible_to_user));

        // Test notes are ordered by creation time
        for i in 1..all_notes.len() {
            if let (Some(prev_time), Some(curr_time)) = (all_notes[i-1].created_at, all_notes[i].created_at) {
                assert!(prev_time <= curr_time, "Notes should be ordered by creation time");
            }
        }
    }

    #[test]
    fn test_note_author_relationships() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());
        let completion = create_test_completion(&context, chore.id.unwrap(), user.id.unwrap());

        // Test user note has correct author relationships
        let user_note_input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion.id.unwrap(),
            author_type: AuthorType::User,
            author_user_id: Some(user.id.unwrap()),
            author_admin_id: None,
            note_text: "User note".to_string(),
            visible_to_user: None, // Should default to true
        };

        let user_note = ChoreCompletionNote::from(user_note_input);
        let created_user_note = ChoreCompletionNoteSvc::create(&context, &user_note).unwrap();

        assert_eq!(created_user_note.author_type, "user");
        assert_eq!(created_user_note.author_user_id, Some(user.id.unwrap()));
        assert_eq!(created_user_note.author_admin_id, None);
        assert!(created_user_note.visible_to_user); // Should default to true

        // Test admin note has correct author relationships
        let admin_note_input = ChoreCompletionNoteInput {
            uuid: None,
            chore_completion_id: completion.id.unwrap(),
            author_type: AuthorType::Admin,
            author_user_id: None,
            author_admin_id: Some(admin.id.unwrap()),
            note_text: "Admin note".to_string(),
            visible_to_user: Some(false),
        };

        let admin_note = ChoreCompletionNote::from(admin_note_input);
        let created_admin_note = ChoreCompletionNoteSvc::create(&context, &admin_note).unwrap();

        assert_eq!(created_admin_note.author_type, "admin");
        assert_eq!(created_admin_note.author_user_id, None);
        assert_eq!(created_admin_note.author_admin_id, Some(admin.id.unwrap()));
        assert!(!created_admin_note.visible_to_user);
    }

    #[test]
    fn test_note_error_cases() {
        let context = create_test_context();

        // Test get non-existent note
        let result = ChoreCompletionNoteSvc::get(&context, "non-existent-uuid");
        assert!(result.is_err());

        // Test list notes for non-existent completion
        let result = ChoreCompletionNoteSvc::list_for_completion(&context, 99999, false);
        assert!(result.is_ok()); // Should return empty list, not error
        assert_eq!(result.unwrap().len(), 0);

        // Test delete non-existent note (should not error)
        let result = ChoreCompletionNoteSvc::delete(&context, "non-existent-uuid");
        assert!(result.is_ok()); // Diesel delete doesn't error if nothing is deleted
    }

    #[test]
    fn test_note_visibility_filtering() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
        let user = create_test_user(&context, "Test User");

        let chore = create_test_chore(
            &context,
            "Test Chore",
            PaymentType::Daily,
            100,
            day_patterns::every_day(),
            admin.id.unwrap(),
        );

        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());
        let completion = create_test_completion(&context, chore.id.unwrap(), user.id.unwrap());

        // Create a mix of visible and hidden notes
        let visible_notes_count = 3;
        let hidden_notes_count = 2;

        // Create visible notes
        for i in 0..visible_notes_count {
            let note_input = ChoreCompletionNoteInput {
                uuid: None,
                chore_completion_id: completion.id.unwrap(),
                author_type: AuthorType::Admin,
                author_user_id: None,
                author_admin_id: Some(admin.id.unwrap()),
                note_text: format!("Visible note {}", i),
                visible_to_user: Some(true),
            };

            let note = ChoreCompletionNote::from(note_input);
            ChoreCompletionNoteSvc::create(&context, &note).unwrap();
        }

        // Create hidden notes
        for i in 0..hidden_notes_count {
            let note_input = ChoreCompletionNoteInput {
                uuid: None,
                chore_completion_id: completion.id.unwrap(),
                author_type: AuthorType::Admin,
                author_user_id: None,
                author_admin_id: Some(admin.id.unwrap()),
                note_text: format!("Hidden note {}", i),
                visible_to_user: Some(false),
            };

            let note = ChoreCompletionNote::from(note_input);
            ChoreCompletionNoteSvc::create(&context, &note).unwrap();
        }

        // Test admin view (all notes)
        let all_notes = ChoreCompletionNoteSvc::list_for_completion(
            &context,
            completion.id.unwrap(),
            false,
        ).unwrap();
        assert_eq!(all_notes.len(), visible_notes_count + hidden_notes_count);

        // Test user view (only visible notes)
        let visible_notes = ChoreCompletionNoteSvc::list_for_completion(
            &context,
            completion.id.unwrap(),
            true,
        ).unwrap();
        assert_eq!(visible_notes.len(), visible_notes_count);
        assert!(visible_notes.iter().all(|note| note.visible_to_user));
    }
}
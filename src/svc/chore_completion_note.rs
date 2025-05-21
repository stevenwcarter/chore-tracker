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
/**
 * The tint painted down today's column in the weekly grid - on the header cell
 * and on every body cell beneath it.
 *
 * Deliberately translucent. `ChoreRow`'s `<tr>` carries `hover:bg-gray-700`, and
 * a cell background paints over its row's; an opaque tint would leave today's
 * column as a dead notch in the hover highlight. At 10% the two composite, so a
 * hovered row reads as hovered all the way across and today still reads as
 * today.
 *
 * Shared by ChoreGridHeader and ChoreRow so the column cannot end up tinted in
 * one and not the other.
 */
export const TODAY_COLUMN_TINT = 'bg-blue-500/10';

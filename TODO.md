# Chore Tracker #

## Abstract ##

You are to build a chore tracker application. This will allow myself and my wife to keep track of the chores the children have completed, and so we can see how much we should put into each child's account on a regular basis.

Users should be able to tap on their profile icon, click a chore, and mark it as completed.

The code already present shows an example of how the rust backend and react frontend should be structured. The specific sample code around the client calls, etc. can be removed, but preserve the same overall structure.

There are only expected to be 3 users and 2 admins, though other admins may be added in the future through OIDC accounts.


## Tasks ##
- [ ] The app should switch away from using mysql and instead use sqlite, with a database stored at `./db/db.sqlite`.
- [ ] Diesel ORM should be used, and diesel migrations should be applied automatically on app startup.
- [ ] All API communication should use GraphQL powered by Juniper (already set up).
- [ ] It should support login using OIDC for admins.
- [ ] User accounts are created by the admins, and do not have any permissions on them.
- [ ] User accounts should allow uploading an image to represent the user.
- [ ] In the top of the web pages when not logged in, there should be the ability to switch the active user by tapping on their image.
- [ ] Admins should have the ability to approve chores as completed.
- [ ] Users can self-report chore completion, but all of those need to be reviewed by an admin.
- [ ] An admin interface should be created
- [ ] The admin interface should allow us to create chores
- [ ] Each chore created should allow admins to mark which days of the week they should be completed on.
- [ ] Each chore should either have a per-completion amount, or an amount that will be funded if it is completed on all required days at the end of each week. (daily vs weekly)
- [ ] Each chore should allow tagging users, which decides whether the chore is visible to that user or not.
- [ ] Each individual chore completion should be a record in the database.
- [ ] Each individual chore record should allow the user _and_ the admin to add notes.
- [ ] Chore notes added by the admin should have a flag which denotes whether it is shown to the user, or only visible to other admins.
- [ ] The default view for the users upon logging in should be a weekly view, showing the status of previously completed chores along the vertical axis on the left, and the dates along the top edge. Any notes visible for the chores previously completed should be shown, as well as whether the admin has approved the chore completion or not.
- [ ] Admins should have the same default view as the users, but also showing admin notes on individual entries if present.
- [ ] When admins are logged in, they should have a view that shows a running total of how much money is to be paid out to each user
- [ ] When the admin has paid out, they should be able to click a button to mark the current outstanding completions as paid out, resetting back to $0 for each user. (This should only be a logical reporting change, no data should be removed, just mark the individual chore records as paid with a paid date recorded. The absence of that paid date could signify that it has not been paid yet.)
- [ ] Individual chore completions should include the dollar amount in the record itself. This way if the chore completion amount changes in the future, there is no change to historical data.


- [ ] Add notes retrieval to GraphQL object for Chores

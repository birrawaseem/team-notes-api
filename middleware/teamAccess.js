const pool = require('../db');

async function requireTeamMember(req, res, next) {
    const teamId = Number(req.params.teamId);

    if (!Number.isInteger(teamId) || teamId <= 0) {
        return res.status(400).json({ error: 'Invalid team id' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        /** Notice it returns 404, not 403, for teams you’re not in. 
        That way, outsiders can’t even tell whether a team exists. **/

        req.teamId = teamId;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = requireTeamMember;
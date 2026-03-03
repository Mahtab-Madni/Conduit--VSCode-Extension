import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { User } from "../models/index.js";

// Configure GitHub OAuth strategy
const configurePassport = () => {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ githubId: profile.id });

          if (user) {
            // Update existing user
            user.accessToken = accessToken;
            user.refreshToken = refreshToken;
            user.displayName = profile.displayName || profile.username;
            user.email = profile.emails?.[0]?.value;
            user.avatarUrl = profile.photos?.[0]?.value;
            await user.save();
          } else {
            // Create new user
            user = new User({
              githubId: profile.id,
              username: profile.username,
              displayName: profile.displayName || profile.username,
              email: profile.emails?.[0]?.value,
              avatarUrl: profile.photos?.[0]?.value,
              profileUrl: profile.profileUrl,
              accessToken,
              refreshToken,
            });
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      },
    ),
  );
};

export { configurePassport };
export default passport;

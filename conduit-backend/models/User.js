import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    githubId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    avatarUrl: {
      type: String,
      required: false,
    },
    profileUrl: {
      type: String,
      required: false,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const User = model("User", userSchema);

export default User;

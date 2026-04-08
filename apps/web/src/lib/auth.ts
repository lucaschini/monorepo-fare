import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const res = await fetch(
          `${process.env.API_URL || "http://localhost:3001"}/auth/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              senha: credentials?.senha,
            }),
          },
        );

        if (!res.ok) return null;

        const data = await res.json();

        return {
          id: String(data.usuario.id),
          name: data.usuario.nome,
          email: data.usuario.email,
          apiToken: data.token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.apiToken = (user as any).apiToken;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).apiToken = token.apiToken;
      (session as any).userId = token.userId;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

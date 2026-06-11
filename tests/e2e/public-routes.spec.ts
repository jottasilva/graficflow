import { expect, test } from "@playwright/test";

test("home page shows storefront content and product navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/GraphFlow/);
  await expect(page.getByRole("heading", { name: /Soluções gráficas/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Conheça nossos produtos/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Produtos mais vendidos/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrar Minha conta/i })).toHaveAttribute("href", "/painel");
});

test("login page exposes the expected authentication controls", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /Bem-vindo de volta/i })).toBeVisible();
  await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar link" })).toBeVisible();
});

test("signup page validates account creation fields", async ({ page }) => {
  await page.goto("/cadastro");

  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();
  await expect(page.getByPlaceholder("Seu nome")).toBeVisible();
  await expect(page.getByPlaceholder("Nome da gráfica")).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
});

test("panel route falls back to login when no API is configured", async ({ page }) => {
  await page.goto("/painel");

  await expect(page.getByRole("heading", { name: /Bem-vindo de volta/i })).toBeVisible();
  await page.getByPlaceholder("seu@email.com").fill("admin@graphflow.test");
  await page.getByPlaceholder("••••••••").fill("Senha123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("API do GraphFlow não configurada.")).toBeVisible();
});

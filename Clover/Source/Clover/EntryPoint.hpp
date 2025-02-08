#pragma once

#include <memory>
#include "Application.hpp"

extern Clover::Application* Clover::CreateApplication();

int main(int argc, char** argv)
{
	std::unique_ptr<Clover::Application> app(Clover::CreateApplication());
	app->Run();
	return 0;
}
import UIKit

final class SampleRootTabBarController: UITabBarController {
    override func viewDidLoad() {
        super.viewDidLoad()

        tabBar.tintColor = UIColor(red: 0.84, green: 0.41, blue: 0.18, alpha: 1)
        tabBar.unselectedItemTintColor = UIColor(white: 0.44, alpha: 1)

        viewControllers = [
            wrapped(
                root: SampleHomeViewController(),
                title: "Home",
                imageName: "house.fill"
            ),
            wrapped(
                root: SamplePlaceholderViewController(
                    titleText: "Search",
                    subtitleText: "Use this tab to verify the story bar sits inside a more realistic tab shell.",
                    symbolName: "magnifyingglass.circle.fill"
                ),
                title: "Search",
                imageName: "magnifyingglass"
            ),
            wrapped(
                root: SamplePlaceholderViewController(
                    titleText: "List",
                    subtitleText: "Placement parity matters more than polish here. This host app is intentionally narrow.",
                    symbolName: "list.bullet.rectangle.portrait.fill"
                ),
                title: "List",
                imageName: "list.bullet"
            ),
        ]
    }

    private func wrapped(
        root: UIViewController,
        title: String,
        imageName: String
    ) -> UIViewController {
        let navigationController = UINavigationController(rootViewController: root)
        navigationController.tabBarItem = UITabBarItem(
            title: title,
            image: UIImage(systemName: imageName),
            selectedImage: nil
        )
        navigationController.navigationBar.prefersLargeTitles = true
        navigationController.navigationBar.tintColor = UIColor(red: 0.2, green: 0.12, blue: 0.07, alpha: 1)
        return navigationController
    }
}
